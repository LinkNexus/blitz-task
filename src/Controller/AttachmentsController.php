<?php

namespace App\Controller;

use App\Entity\Attachment;
use App\Service\FileManager;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Path;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

#[Route("/api/attachments", name: "api.attachments.")]
final class AttachmentsController extends AbstractController
{

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
    )
    {
    }

    #[Route("/{filename}", name: "view", methods: ["GET"])]
    public function view(
        string                                      $filename,
        #[Autowire("%kernel.project_dir%/uploads")] $uploadsDir,
    ): BinaryFileResponse|JsonResponse
    {
        /** @var ?Attachment $attachment */
        $attachment = $this->entityManager
            ->getRepository(Attachment::class)
            ->findWithTeamByParam("filename", $filename);

        if (!$attachment) {
            return $this->json([
                "message" => "The attachment with the given filename does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $this->denyAccessUnlessGranted("TEAM_MEMBER", $attachment->getTask()->getProject()->getTeam());

        return $this->file(Path::join($uploadsDir, $attachment->getFilename()));
    }

    #[Route("/{id}", name: "remove_attachment", methods: ["DELETE"])]
    public function delete(
        int         $id,
        FileManager $fileManager
    ): JsonResponse
    {
        $attachment = $this->entityManager
            ->getRepository(Attachment::class)
            ->findWithTeamByParam("id", $id);

        if (!$attachment) {
            return $this->json([
                "message" => "The attachment with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $this->denyAccessUnlessGranted("TEAM_MEMBER", $attachment->getTask()->getProject()->getTeam());

        $fileManager->delete($attachment->getFilename());

        $this->entityManager->remove($attachment);
        $this->entityManager->flush();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }
}
