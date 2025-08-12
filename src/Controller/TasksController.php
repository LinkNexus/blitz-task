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
        private readonly ProjectRepository      $projectRepository,
    )
    {
    }

    #[Route("", name: "create", methods: ["POST"])]
    public function create(
        #[MapRequestPayload] TaskDTO $dto,
        #[CurrentUser] User          $user
    ): JsonResponse
    {
        $column = $this->taskColumnRepository->findWithProjectAndTeam($dto->columnId);

        if (null === $column) {
            return $this->json([
                "violations" => [
                    [
                        "propertyPath" => "columnId",
                        "title" => "The Column with the given ID does not exist."
                    ]
                ]
            ], Response::HTTP_NOT_FOUND);
        }

        $project = $column->getProject();
        $team = $project->getTeam();
        $this->denyAccessUnlessGranted("TEAM_MEMBER", $team);

        $task = new Task()
            ->setName($dto->name)
            ->setDescription($dto->description)
            ->setRelatedColumn($column)
            ->setPriority($dto->priority)
            ->setDueAt(new DateTimeImmutable($dto->dueAt))
            ->setScore($this->taskRepository->findHighestTaskScore($column->getId()) + 100)
            ->setProject($project);

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
        $column = $this->taskColumnRepository->findWithProjectAndTeam($dto->columnId);

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
            ->setPriority($dto->priority)
            ->setDueAt($dto->dueAt ? new DateTimeImmutable($dto->dueAt) : null);

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
        #[MapRequestPayload] MoveTaskDTO $dto,
        #[MapQueryParameter] int         $projectId
    ): JsonResponse
    {
        $project = $this->projectRepository->findWithTeam($projectId);

        if (!$project) {
            return $this->json([
                "error" => "The project with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $team = $project->getTeam();
        $this->denyAccessUnlessGranted("TEAM_MEMBER", $team);

        /** @var ?Task $task */
        $task = $this->taskRepository->find($dto->id);

        if ($task && $project->getTasks()->contains($task)) {
            if ($dto->columnId) {
                $column = $this->taskColumnRepository->find($dto->columnId);

                if ($column && $project->getColumns()->contains($column)) {
                    $task->setRelatedColumn($column);
                }
            }

            $task->setScore($dto->score);
        }

        $this->entityManager->flush();
        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    #[Route("/{id}", name: "delete", methods: ["DELETE"])]
    public function delete(
        int                 $id,
        #[CurrentUser] User $user
    ): JsonResponse
    {
        /** @var ?Task $task */
        $task = $this->entityManager
            ->createQueryBuilder()
            ->select("task")
            ->from(Task::class, "task")
            ->leftJoin("task.project", "project")
            ->addSelect("project")
            ->leftJoin("project.team", "team")
            ->addSelect("team")
            ->andWhere("task.id = :taskId")
            ->setParameter("taskId", $id)
            ->getQuery()
            ->getOneOrNullResult();

        if (!$task) {
            return $this->json([
                "error" => "The task with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $this->denyAccessUnlessGranted("TEAM_MEMBER", $task->getProject()->getTeam());
        $this->entityManager->remove($task);
        $this->entityManager->flush();
        return $this->json(null, Response::HTTP_NO_CONTENT);
    }
}
