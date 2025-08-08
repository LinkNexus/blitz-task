<?php

declare(strict_types=1);

namespace App\Controller;

use App\Entity\Project;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/projects', name: "api.projects", format: "json")]
class ProjectsController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager
    )
    {
    }

    #[Route('/default', name: "default", methods: ["GET"])]
    #[IsGranted("IS_AUTHENTICATED_FULLY")]
    public function getDefaultProject(
        #[CurrentUser] User $user
    ): Response
    {
        return $this->json(
            $this->entityManager->getRepository(Project::class)
                ->findDefaultByUser($user->getId()),
            context: ["groups" => ["projects:read"]]
        );
    }

    #[Route("", name: "list", methods: ["GET"])]
    #[IsGranted("IS_AUTHENTICATED_FULLY")]
    public function index(
        #[MapQueryParameter] int $teamId
    )
    {
        return $this->json(
            $this->entityManager->getRepository(Project::class)
                ->findByTeam($teamId),
            context: ["groups" => ["projects:read"]]
        );
    }
}
