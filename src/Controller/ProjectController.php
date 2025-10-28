<?php

namespace App\Controller;

use App\Attribute\ValidateCsrfHeader;
use App\DTO\ProjectDTO;
use App\Entity\Project;
use App\Entity\User;
use App\Repository\ProjectRepository;
use App\Service\FileUploader;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\HttpKernel\Attribute\MapUploadedFile;
use Symfony\Component\ObjectMapper\ObjectMapperInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Validator\Constraints\Image;

#[Route('/api/projects', name: 'api.projects.')]
#[IsGranted('ROLE_USER')]
#[ValidateCsrfHeader]
final class ProjectController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ProjectRepository $projectRepository,
        private FileUploader $fileUploader,
        private readonly ObjectMapperInterface $objectMapper
    ) {}

    #[Route('', name: 'list', methods: ['GET'])]
    #[ValidateCsrfHeader]
    public function getProjects(#[CurrentUser] User $user): JsonResponse
    {
        return $this->json(
            $this->projectRepository->findProjectsByUser($user->getId()),
            context: ['groups' => 'projects:read']
        );
    }

    #[Route('/{id}', name: 'get', methods: ['GET'])]
    public function getProject(Project $project, #[CurrentUser] User $user): JsonResponse
    {
        return $this->json(
            $project,
            context: ['groups' => 'project:read']
        );
    }

    #[Route('', name: 'create', methods: ['POST'])]
    public function create(
        #[MapRequestPayload] ProjectDTO $projectDTO,
        #[MapUploadedFile(
            constraints: [
                new Image(
                    maxSize: '2M'
                ),
            ]
        )] ?UploadedFile $image,
        #[CurrentUser] User $user
    ): JsonResponse {

        /** @var Project */
        $project = $this->objectMapper->map($projectDTO);

        if ($image !== null) {
            $res = $this->fileUploader->upload($image, 'projects');
            $project->setImage($res['filename']);
        }

        $project->setCreatedBy($user);
        $project->addParticipant($user);

        $this->entityManager->persist($project);
        $this->entityManager->flush();

        return $this->json(
            $project,
            context: ['groups' => 'project:read'],
            status: 201
        );
    }

    #[Route('/{id}', name: 'update', methods: ['PUT'])]
    public function update(
        Project $project,
        #[MapRequestPayload] ProjectDTO $projectDTO,
    ) {

        $this->denyAccessUnlessGranted('PROJECT_PARTICIPANT', $project);

        $this->objectMapper->map(
            source: $projectDTO,
            target: $project,
        );

        $this->entityManager->flush();

        return $this->json(
            $project,
            context: ['groups' => 'project:read'],
        );

    }
}
