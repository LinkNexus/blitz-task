<?php

namespace App\Controller;

use App\Entity\TaskLabel;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\Routing\Attribute\Route;

#[Route("/api/labels", name: "api.labels.", format: "json")]
final class TaskLabelController extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
    }

    #[Route('', name: 'get_all')]
    public function index(
        #[MapQueryParameter] string $q = ""
    ): Response
    {
        return $this->json(
            $this->entityManager
                ->getRepository(TaskLabel::class)
                ->findAllByQuery($q),
            context: ["groups" => "labels:read"]
        );
    }
}
