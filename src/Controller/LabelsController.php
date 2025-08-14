<?php

namespace App\Controller;

use App\Entity\Label;
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
}
