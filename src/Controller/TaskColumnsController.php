<?php

declare(strict_types=1);

namespace App\Controller;

use App\DTO\ColumnDTO;
use App\Entity\Project;
use App\Entity\TaskColumn;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/columns', name: "api.columns.", format: "json")]
class TaskColumnsController extends AbstractController
{

    public function __construct(
        private readonly EntityManagerInterface $entityManager
    )
    {
    }

    #[Route("", name: "get", methods: ["GET"])]
    #[IsGranted("IS_AUTHENTICATED_FULLY")]
    public function index(
        #[MapQueryParameter] int $projectId
    ): Response
    {
        $project = $this->entityManager
            ->getRepository(Project::class)
            ->createQueryBuilder("p")
            ->select("p")
            ->leftJoin("p.team", "t")
            ->addSelect('t')
            ->leftJoin("p.columns", "c")
            ->addSelect('c')
            ->leftJoin("c.tasks", "tasks")
            ->addSelect('tasks')
            ->leftJoin("tasks.assignees", "a")
            ->addSelect('a')
            ->leftJoin("tasks.labels", "l")
            ->addSelect('l')
            ->where("p.id = :id")
            ->setParameter("id", $projectId)
            ->getQuery()
            ->getOneOrNullResult();

        if (!$project) {
            return $this->json([
                "error" => "The project with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $this->denyAccessUnlessGranted("TEAM_MEMBER", $project->getTeam());

        return $this->json(
            $project->getColumns(),
            context: ["groups" => ["columns:read"]]
        );
    }

    #[Route("", name: "create", methods: ["POST"])]
    public function create(
        #[MapRequestPayload] ColumnDTO $dto,
    ): JsonResponse
    {
        $project = $this->entityManager
            ->getRepository(Project::class)
            ->findWithTeam($dto->projectId);

        if (!$project) {
            return $this->json([
                "error" => "The project with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $this->denyAccessUnlessGranted("TEAM_MEMBER", $project->getTeam());

        $column = new TaskColumn()
            ->setName($dto->name)
            ->setColor($dto->color)
            ->setScore($dto->score)
            ->setProject($project);

        $this->entityManager->persist($column);
        $this->entityManager->flush();

        return $this->json($column, context: ["groups" => ["columns:read"]]);
    }

    #[Route("/{id}", name: "update", methods: ["PUT"])]
    public function update(
        TaskColumn                     $column,
        #[MapRequestPayload] ColumnDTO $dto,
    ): JsonResponse
    {
        $project = $column->getProject();
        $team = $project->getTeam();
        $this->denyAccessUnlessGranted("TEAM_MEMBER", $team);

        $column->setName($dto->name)
            ->setColor($dto->color)
            ->setScore($dto->score);

        $this->entityManager->flush();

        return $this->json($column, context: ["groups" => ["columns:read"]]);
    }

    #[Route("/{id}", name: "delete", methods: ["DELETE"])]
    public function delete(int $id): JsonResponse
    {
        $column = $this->entityManager
            ->getRepository(TaskColumn::class)
            ->createQueryBuilder("c")
            ->select("c")
            ->leftJoin("c.project", "p")
            ->addSelect('p')
            ->leftJoin("p.team", "t")
            ->addSelect('t')
            ->where("c.id = :id")
            ->setParameter("id", $id)
            ->getQuery()
            ->getOneOrNullResult();

        if (!$column) {
            return $this->json([
                "error" => "The column with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $this->denyAccessUnlessGranted("TEAM_MEMBER", $column->getProject()->getTeam());
        $this->entityManager->remove($column);
        $this->entityManager->flush();
        return $this->json(null, Response::HTTP_NO_CONTENT);
    }
}
