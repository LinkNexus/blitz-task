<?php

namespace App\Controller;

use App\Entity\TaskTag;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\String\Slugger\SluggerInterface;

#[Route("/api/labels", name: "api.labels.", format: "json")]
final class TaskTagController extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
    }

    #[Route('', name: 'get_all', methods: ["GET"])]
    public function index(
        #[MapQueryParameter] string $q = ""
    ): Response
    {
        return $this->json(
            $this->entityManager
                ->getRepository(TaskTag::class)
                ->findAllByQuery($q),
            context: ["groups" => "tags:read"]
        );
    }

    #[Route('', name: 'create', methods: ["POST"])]
    public function create(
        #[MapRequestPayload] TaskTag $tag,
        SluggerInterface             $slugger
    ): JsonResponse
    {
        $tag->setSlug($slugger->slug($tag->getName())->lower()->toString());
        $this->entityManager->persist($tag);
        $this->entityManager->flush();

        return $this->json($tag, status: 201, context: ["groups" => "tags:read"]);
    }
}
