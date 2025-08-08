<?php

namespace App\Controller;

use App\Entity\Team;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route("/api/teams", name: "api.teams.", format: "json")]
#[IsGranted("IS_AUTHENTICATED_FULLY")]
class TeamsController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    )
    {
    }

    #[Route("/default", name: "default", methods: ["GET"])]
    public function getDefaultTeam(
        #[CurrentUser] User $user
    ): JsonResponse
    {
        return $this->json(
            $this->entityManager->getRepository(Team::class)
                ->findDefaultByUser($user->getId()),
            context: ["groups" => ["teams:read"]]
        );
    }

    #[Route("", name: "list", methods: ["GET"])]
    public function index(
        #[CurrentUser] User $user
    ): JsonResponse
    {
        return $this->json(
            $this->entityManager->getRepository(Team::class)->findByUser($user->getId()),
            context: ["groups" => ["teams:read"]]
        );
    }
}
