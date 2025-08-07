<?php

namespace App\Controller;

use App\DTO\TaskDTO;
use App\Entity\Task;
use App\Entity\TaskColumn;
use App\Entity\TaskLabel;
use App\Repository\TaskColumnRepository;
use App\Repository\TaskLabelRepository;
use App\Repository\TaskRepository;
use DateTimeImmutable;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\String\Slugger\SluggerInterface;

#[Route('/api/tasks', name: 'api.tasks.', format: 'json')]
final class TasksController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly TaskRepository         $taskRepository,
        private readonly TaskLabelRepository    $labelRepository,
        private readonly TaskColumnRepository   $columnRepository,
        private readonly SluggerInterface       $slugger
    )
    {
    }

    #[Route("", name: "index", methods: ["GET"])]
    public function index(
        #[MapQueryParameter] int $projectId
    ): JsonResponse
    {
        $columns = $this->columnRepository->findByProject($projectId);

        return $this->json(
            array_map(function (TaskColumn $column) {
                return [
                    "column" => $column,
                    "tasks" => $this->taskRepository->findTasksByColumn($column->getId(), 0),
                    "count" => $this->taskRepository->findTaskCountByColumn($column->getId())
                ];
            }, $columns),
            context: ["groups" => ["column:read"]]
        );
    }

    #[Route("", name: "create", methods: ["POST"])]
    public function create(
        #[MapRequestPayload] TaskDTO $dto,
    ): JsonResponse
    {
        $column = $this->taskRepository->find($dto->column);

        if (null === $column) {
            return $this->json([
                "error" => "Column not found"
            ], Response::HTTP_NOT_FOUND);
        }

        $task = new Task()
            ->setName($dto->name)
            ->setScore($dto->score)
            ->setRelatedColumn($column)
            ->setPriority($dto->priority)
            ->setDueAt(new DateTimeImmutable($dto->dueAt));

        foreach ($dto->labels as $l) {
            $label = $this->labelRepository->findBySlug($l);

            if (null === $label) {
                $label = new TaskLabel()
                    ->setName($l)
                    ->setSlug($this->slugger->slug($l)->lower()->toString());
            }

            $task->addLabel($label);
        }

        $this->entityManager->persist($task);
        $this->entityManager->flush();

        return $this->json($task);
    }
}
