<?php

namespace App\Controller;

use App\Entity\Team;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\Routing\Attribute\Route;

#[Route("/api/teams", name: "api.teams.", format: "json")]
class TeamsController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    )
    {
    }

    #[Route("", name: "list", methods: ["GET"])]
    public function index(
        #[MapQueryParameter] int $userId
    )
    {
        return $this->json(
            $this->entityManager->getRepository(Team::class)->findByUser($userId),
            context: ["groups" => ["teams:read"]]
        );
    }
}
