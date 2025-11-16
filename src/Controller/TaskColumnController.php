<?php

namespace App\Controller;

use App\Entity\Project;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\Normalizer\NormalizerInterface;

#[Route('/api/columns', name: 'api.columns', format: 'json')]
#[IsGranted('ROLE_USER')]
final class TaskColumnController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly NormalizerInterface $normalizer,
    ) {}

    #[Route('', name: 'get_columns', methods: ['GET'])]
    public function getColumns(
        #[MapQueryParameter] int $projectId
    ) {

        /** @var Project|null $project */
        $project = $this->entityManager
            ->getRepository(Project::class)
            ->createQueryBuilder('p')
            ->leftJoin('p.columns', 'c')
            ->addSelect('c')
            ->leftJoin('c.tasks', 't')
            ->addSelect('t')
            ->leftJoin('t.labels', 'l')
            ->addSelect('l')
            ->where('p.id = :projectId')
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
}
