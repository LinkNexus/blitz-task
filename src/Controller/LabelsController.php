<?php

namespace App\Controller;

use App\Entity\Label;
use App\Entity\Task;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\String\Slugger\SluggerInterface;

#[Route('/api/labels', name: 'api.labels.', format: 'json')]
#[IsGranted("IS_AUTHENTICATED_FULLY")]
final class LabelsController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    )
    {
    }

    #[Route('', name: 'search', methods: ['GET'])]
    public function search(
        #[MapQueryParameter] string $query,
        #[MapQueryParameter] int    $limit = 5,
    ): JsonResponse
    {
        $labels = $this->entityManager
            ->createQueryBuilder()
            ->select("label")
            ->from(Label::class, "label")
            ->where("ILIKE(label.name, :query) = true")
            ->orWhere("ILIKE(label.slug, :query) = true")
            ->setParameter("query", "%$query%")
            ->orderBy("label.name", "ASC")
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();

        return $this->json($labels);
    }

    #[Route("", name: "create", methods: ["POST"])]
    public function create(
        #[MapRequestPayload] Label $label,
        SluggerInterface           $slugger
    ): JsonResponse
    {
        if ($this->entityManager->getRepository(Label::class)->findOneBySlug($label->getName())) {
            return $this->json([
                "violations" => [
                    "propertyPath" => "name",
                    "title" => "This label already exists."
                ]
            ], Response::HTTP_BAD_REQUEST);
        }

        $label->setSlug($slugger->slug($label->getName())->lower()->toString());
        $this->entityManager->persist($label);
        $this->entityManager->flush();

        return $this->json($label);
    }

    #[Route("/add/{id}", name: "add", methods: ["POST"])]
    public function add(
        Label                    $label,
        #[MapQueryParameter] int $taskId
    ): JsonResponse
    {
        $task = $this->entityManager->getRepository(Task::class)->find($taskId);

        if (!$task) {
            return $this->json([
                "message" => "The task with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $task->addLabel($label);
        $this->entityManager->flush();
        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    #[Route("/remove/{id}", name: "remove", methods: ["POST"])]
    public function remove(
        Label                    $label,
        #[MapQueryParameter] int $taskId
    ): JsonResponse
    {
        $task = $this->entityManager->getRepository(Task::class)->find($taskId);

        if (!$task) {
            return $this->json([
                "message" => "The task with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $task->removeLabel($label);
        $this->entityManager->flush();
        return $this->json(null, Response::HTTP_NO_CONTENT);
    }
}
