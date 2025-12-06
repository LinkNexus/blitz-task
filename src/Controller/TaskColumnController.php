<?php

namespace App\Controller;

use App\DTO\TaskColumnDTO;
use App\Entity\Project;
use App\Entity\TaskColumn;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

#[Route('/api/columns', name: 'api.columns', format: 'json')]
#[IsGranted('ROLE_USER')]
final class TaskColumnController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly NormalizerInterface    $normalizer,
    )
    {
    }

    #[Route('', name: 'get_columns', methods: ['GET'])]
    public function getColumns(
        #[MapQueryParameter] int $projectId
    )
    {

        /** @var Project|null $project */
        $project = $this->entityManager
            ->getRepository(Project::class)
            ->createQueryBuilder('p')
            ->leftJoin('p.columns', 'c')
            ->addSelect('c')
            ->leftJoin('c.tasks', 't')
            ->addSelect('t')
            ->leftJoin('t.tags', 'l')
            ->addSelect('l')
            ->where('p.id = :projectId')
            ->orderBy("c.score", "ASC")
            ->setParameter('projectId', $projectId)
            ->getQuery()
            ->getOneOrNullResult();

        if ($project === null) {
            throw $this->createNotFoundException('Project not found');
        }

        $this->denyAccessUnlessGranted('PROJECT_PARTICIPANT', $project);

        return $this->json([
            ...(
            array_map(
                function ($column) {
                    return [
                        ...(
                        $this->normalizer
                            ->normalize(
                                $column,
                                context: ['groups' => ['column:read']]
                            )
                        ),
                        'tasks' => $this->normalizer
                            ->normalize(
                                $column->getTasks(),
                                context: ['groups' => ['task:read']]
                            ),
                    ];
                },
                $project->getColumns()->toArray()
            )
            ),
        ]);

    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(
        #[MapRequestPayload] TaskColumnDTO $dto,
        #[MapQueryParameter] int           $projectId,
    ): JsonResponse
    {
        $project = $this->entityManager->getRepository(Project::class)->find($projectId);

        if (!$project) {
            throw $this->createNotFoundException('Project not found');
        }

        $this->denyAccessUnlessGranted('PROJECT_PARTICIPANT', $project);

        $column = new TaskColumn()
            ->setName($dto->name);

        if ($dto->score) {
            $column->setScore($dto->score);
        }

        $project->addColumn($column);

        $this->entityManager->persist($column);
        $this->entityManager->flush();

        return $this->json($column, status: 201, context: ['groups' => 'column:read']);
    }

    #[Route('/{id}', name: 'update', methods: ['POST'])]
    public function update(
        #[MapRequestPayload] TaskColumnDTO $dto,
        int                                $id
    ): JsonResponse
    {
        $column = $this->entityManager
            ->getRepository(TaskColumn::class)
            ->findWithProject($id);

        if (!$column) {
            throw $this->createNotFoundException('Column not found');
        }

        $this->denyAccessUnlessGranted('PROJECT_PARTICIPANT', $column->getProject());

        $column->setName($dto->name);

        if ($dto->score) {
            $column->setScore($dto->score);
        }

        $this->entityManager->flush();
        return $this->json($column, context: ["groups" => "column:read"]);
    }

    #[Route('/{id}', name: 'delete', methods: ['DELETE'])]
    public function delete(int $id): JsonResponse
    {
        $column = $this->entityManager
            ->getRepository(TaskColumn::class)
            ->findWithProject($id);

        if (!$column) {
            throw $this->createNotFoundException('Column not found');
        }

        $this->denyAccessUnlessGranted('PROJECT_PARTICIPANT', $column->getProject());

        $this->entityManager->remove($column);
        $this->entityManager->flush();
        return $this->json(null, 204);
    }
}
