<?php

namespace App\Controller;

use App\Attribute\NotValidateCsrfHeader;
use App\Attribute\ValidateCsrfHeader;
use App\DTO\ProjectDTO;
use App\Entity\Project;
use App\Entity\User;
use App\Repository\ProjectRepository;
use App\Service\FileUploader;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Path;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
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
    #[IsGranted('PROJECT_PARTICIPANT', subject: 'project')]
    public function getProject(Project $project): JsonResponse
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

    #[Route('/{id}', name: 'update', methods: ['POST'])]
    #[IsGranted('PROJECT_PARTICIPANT', subject: 'project')]
    public function update(
        Project $project,
        #[MapRequestPayload] ProjectDTO $projectDTO,
        #[MapUploadedFile(
            constraints: [
                new Image(
                    maxSize: '2M'
                ),
            ]
        )] ?UploadedFile $image,
    ) {
        $this->objectMapper->map(
            source: $projectDTO,
            target: $project
        );

        if ($image !== null) {
            $this->fileUploader->remove($project->getImage(), 'projects');
            $res = $this->fileUploader->upload($image, 'projects');
            $project->setImage($res['filename']);
        }

        $this->entityManager->flush();

        return $this->json(
            $project,
            context: ['groups' => 'project:read'],
        );

    }

    #[Route('/image/{filename}', name: 'image', methods: ['GET'])]
    #[NotValidateCsrfHeader]
    public function showImage(
        #[Autowire('%kernel.project_dir%/uploads/projects')] string $projectsUploadDir,
        string $filename
    ): BinaryFileResponse {
        return $this->file(
            Path::join($projectsUploadDir, $filename)
        );
    }

    #[Route('/{id}/remove-member', name: 'remove_member', methods: ['POST'])]
    #[IsGranted('PROJECT_OWNER', subject: 'project')]
    public function removeMember(
        Project $project,
        #[MapQueryParameter] int $memberId,
    ) {
        $member = $this->entityManager->getRepository(User::class)->find($memberId);

        if (! $member) {
            return $this->json(['error' => 'Member not found'], 404);
        }

        $project->removeParticipant($member);
        $this->entityManager->flush();

        return $this->json([
            'memberId' => $memberId,
        ]);
    }
}
