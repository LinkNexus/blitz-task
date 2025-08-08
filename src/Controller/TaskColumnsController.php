<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\TaskColumn;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
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
        return $this->json(
            $this->entityManager->getRepository(TaskColumn::class)
                ->findByProject($projectId),
            context: ["groups" => ["column:read"]]
        );
    }
}
