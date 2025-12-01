<?php

namespace App\Controller;

use App\DTO\TaskDTO;
use App\Entity\Task;
use App\Entity\TaskColumn;
use App\Entity\TaskLabel;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;

#[Route("/api/tasks", name: "api.task.", format: "json")]
final class TaskController extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
    }

    #[Route("", name: "create", methods: ["POST"])]
    public function create(
        #[MapRequestPayload] TaskDTO $taskDTO
    ): Response
    {
        $column = $this
            ->entityManager
            ->getRepository(TaskColumn::class)
            ->findWithProject($taskDTO->columnId);

        if (!$column) {
            throw $this->createNotFoundException('Column not found');
        }

        $task = new Task();

        $task->setName($taskDTO->name);
        $task->setDescription($taskDTO->description);
        $task->setDueAt($taskDTO->dueAt);
        $task->setPriority($taskDTO->priority);
        $task->setRelatedColumn($column);

        foreach ($taskDTO->assigneesIds as $assigneeId) {
            $assignee = $this->entityManager
                ->getRepository(User::class)
                ->find($assigneeId);

            if ($assignee && $column->getProject()->getParticipants()->contains($assignee)) {
                $task->addAssignee($assignee);
            }
        }

        foreach ($taskDTO->labelsIds as $labelId) {
            $label = $this->entityManager
                ->getRepository(TaskLabel::class)
                ->find($labelId);

            if ($label) {
                $task->addLabel($label);
            }
        }

        $this->entityManager->persist($task);
        $this->entityManager->flush();

        return $this->json(
            $task,
            context: ["groups" => "task:read"]
        );
    }

    #[Route("/{id}", name: "update", methods: ["POST"])]
    public function update(
        int                          $id,
        #[MapRequestPayload] TaskDTO $taskDTO,
    ): JsonResponse
    {
        $task = $this->entityManager->getRepository(Task::class)
            ->createQueryBuilder("t")
            ->leftJoin("t.column", "c")
            ->addSelect("c")
            ->leftJoin("t.assignees", "a")
            ->addSelect("a")
            ->leftJoin("t.labels", "l")
            ->addSelect("l")
            ->leftJoin("c.project", "p")
            ->addSelect("p")
            ->where("t.id = :id")
            ->setParameter("id", $id)
            ->getQuery()
            ->getOneOrNullResult();

        if (!$task) {
            throw $this->createNotFoundException('Task not found');
        }

        $task->setName($taskDTO->name);
        $task->setDescription($taskDTO->description);
        $task->setDueAt($taskDTO->dueAt);
        $task->setPriority($taskDTO->priority);

        $assigneesIds = $task->getAssignees()->map(fn(User $user) => $user->getId())->toArray();

        $addedAssigneesIds = array_diff($taskDTO->assigneesIds, $assigneesIds);
        $removedAssigneesIds = array_diff($assigneesIds, $taskDTO->assigneesIds);

        foreach ($addedAssigneesIds as $assigneeId) {
            $assignee = $this->entityManager
                ->getRepository(User::class)
                ->find($assigneeId);

            if ($assignee && $task->getRelatedColumn()->getProject()->getParticipants()->contains($assignee)) {
                $task->addAssignee($assignee);
            }
        }

        foreach ($removedAssigneesIds as $assigneeId) {
            $assignee = $this->entityManager
                ->getRepository(User::class)
                ->find($assigneeId);

            if ($assignee) {
                $task->removeAssignee($assignee);
            }
        }

        $addedLabelsIds = array_diff($taskDTO->labelsIds, $task->getLabels()->map(fn(TaskLabel $label) => $label->getId())->toArray());
        $removedLabelsIds = array_diff($task->getLabels()->map(fn(TaskLabel $label) => $label->getId())->toArray(), $taskDTO->labelsIds);

        foreach ($addedLabelsIds as $labelId) {
            $label = $this->entityManager
                ->getRepository(TaskLabel::class)
                ->find($labelId);
            if ($label) {
                $task->addLabel($label);
            }
        }

        foreach ($removedLabelsIds as $labelId) {
            $label = $this->entityManager
                ->getRepository(TaskLabel::class)
                ->find($labelId);
            if ($label) {
                $task->removeLabel($label);
            }
        }

        $this->entityManager->flush();
        return $this->json($task, context: ["groups" => "task:read"]);
    }
}
