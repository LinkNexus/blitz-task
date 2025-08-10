<?php

namespace App\Controller;

use App\DTO\Task\MoveTaskDTO;
use App\DTO\Task\TaskDTO;
use App\Entity\Task;
use App\Entity\User;
use App\Repository\LabelRepository;
use App\Repository\ProjectRepository;
use App\Repository\TaskColumnRepository;
use App\Repository\TaskRepository;
use App\Repository\UserRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route('/api/tasks', name: 'api.tasks.', format: 'json')]
final class TasksController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly TaskRepository         $taskRepository,
        private readonly LabelRepository        $labelRepository,
        private readonly UserRepository         $userRepository,
        private readonly TaskColumnRepository   $taskColumnRepository,
        private readonly ProjectRepository      $projectRepository
    )
    {
    }

    #[Route("", name: "create", methods: ["POST"])]
    public function create(
        #[MapRequestPayload] TaskDTO $dto,
        #[CurrentUser] User          $user
    ): JsonResponse
    {
        $column = $this->taskColumnRepository->find($dto->columnId);

        if (null === $column) {
            return $this->json([
                "error" => "Column not found"
            ], Response::HTTP_NOT_FOUND);
        }

        $team = $column->getProject()->getTeam();
        $this->denyAccessUnlessGranted("TEAM_MEMBER", $team);

        $task = new Task()
            ->setName($dto->name)
            ->setDescription($dto->description)
            ->setRelatedColumn($column)
            ->setPriority($dto->priority)
            ->setDueAt(new DateTimeImmutable($dto->dueAt))
            ->setScore($this->taskRepository->findHighestTaskScore($column->getId()) + 100);

        foreach ($dto->labelIds as $id) {
            $label = $this->labelRepository->find($id);
            if ($label) {
                $task->addLabel($label);
            }
        }

        if (empty($dto->assigneeIds) && $team->isDefault()) {
            $task->addAssignee($user);
        } else {
            foreach ($dto->assigneeIds as $id) {
                $assignee = $this->userRepository->find($id);
                if ($assignee) {
                    $task->addAssignee($assignee);
                }
            }
        }

        $this->entityManager->persist($task);
        $this->entityManager->flush();

        return $this->json($task, Response::HTTP_CREATED, context: ["groups" => ["tasks:read"]]);
    }

    #[Route("/{id}", name: "update", methods: ["PUT"])]
    public function update(
        Task                         $task,
        #[MapRequestPayload] TaskDTO $dto,
        #[CurrentUser] User          $user
    ): JsonResponse
    {
        $column = $this->taskColumnRepository->find($dto->columnId);

        if (null === $column) {
            return $this->json([
                "error" => "Column not found"
            ], Response::HTTP_NOT_FOUND);
        }

        $team = $column->getProject()->getTeam();
        $this->denyAccessUnlessGranted("TEAM_MEMBER", $team);

        // Update task properties
        $task->setName($dto->name)
            ->setDescription($dto->description)
            ->setRelatedColumn($column)
            ->setPriority($dto->priority);

        // Update due date if provided
        if ($dto->dueAt !== null) {
            $task->setDueAt(new DateTimeImmutable($dto->dueAt));
        }

        // Clear existing labels and add new ones
        $task->getLabels()->clear();
        foreach ($dto->labelIds as $id) {
            $label = $this->labelRepository->find($id);
            if ($label) {
                $task->addLabel($label);
            }
        }

        // Clear existing assignees and add new ones
        $task->getAssignees()->clear();
        if (empty($dto->assigneeIds) && $team->isDefault()) {
            $task->addAssignee($user);
        } else {
            foreach ($dto->assigneeIds as $id) {
                $assignee = $this->userRepository->find($id);
                if ($assignee) {
                    $task->addAssignee($assignee);
                }
            }
        }

        $this->entityManager->flush();

        return $this->json($task, Response::HTTP_OK, context: ["groups" => ["tasks:read"]]);
    }

    /**
     * Handles the movement of tasks between columns.
     *
     * This method processes an array of MoveTaskDTO objects, updates task attributes such
     * as the related column and score, and persists the changes to the database.
     *
     * @param MoveTaskDTO[] $dtos Array of Data Transfer Objects containing task movement information.
     *
     * @return JsonResponse Returns an empty response with HTTP 204 No Content status upon success.
     */
    #[Route("/move", name: "move", methods: ["POST"])]
    public function move(
        #[MapRequestPayload(type: MoveTaskDTO::class)] array $dtos,
        #[MapQueryParameter] int                             $teamId
    ): JsonResponse
    {
//        $project = $this->projectRepository->find($projectId);
//        $team = $project->getTeam();

//        $this->denyAccessUnlessGranted("TEAM_MEMBER", $team);

        foreach ($dtos as $dto) {
            $task = $this->taskRepository->find($dto->id);

            if ($dto->columnId) {
                $column = $this->taskColumnRepository->find($dto->columnId);
                $task->setRelatedColumn($column);
            }

            $task->setScore($dto->score);
        }

        $this->entityManager->flush();
        return $this->json(null, Response::HTTP_NO_CONTENT);
    }
}
