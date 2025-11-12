<?php

namespace App\Controller;

use App\Attribute\NotValidateCsrfHeader;
use App\Attribute\ValidateCsrfHeader;
use App\DTO\InviteMemberDTO;
use App\DTO\ProjectDTO;
use App\Entity\Project;
use App\Entity\ProjectInvitation;
use App\Entity\User;
use App\Repository\ProjectRepository;
use App\Service\FileUploader;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Path;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\HttpKernel\Attribute\MapUploadedFile;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\ObjectMapper\ObjectMapperInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\Serializer\SerializerInterface;
use Symfony\Component\Validator\Constraints\Image;

#[Route('/api/projects', name: 'api.projects.')]
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
    #[IsGranted('ROLE_USER')]
    public function getProjects(#[CurrentUser] User $user): JsonResponse
    {
        return $this->json(
            $this->projectRepository->findProjectsByUser($user->getId()),
            context: ['groups' => 'projects:read']
        );
    }

    #[Route('/{id}', name: 'get', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[IsGranted('PROJECT_PARTICIPANT', subject: 'project')]
    public function getProject(Project $project): JsonResponse
    {
        return $this->json(
            $project,
            context: ['groups' => 'project:read']
        );
    }

    #[Route('', name: 'create', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
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
    #[IsGranted('ROLE_USER')]
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
    #[IsGranted('ROLE_USER')]
    public function showImage(
        #[Autowire('%kernel.project_dir%/uploads/projects')] string $projectsUploadDir,
        string $filename
    ): BinaryFileResponse {
        return $this->file(
            Path::join($projectsUploadDir, $filename)
        );
    }

    #[Route('/{id}/remove-member', name: 'remove_member', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    #[IsGranted('PROJECT_OWNER', subject: 'project')]
    public function removeMember(
        Project $project,
        #[MapQueryParameter] int $memberId,
    ) {
        $member = $this->entityManager->getRepository(User::class)->find($memberId);

        if (! $member) {
            return $this->json(['message' => 'Member not found'], 404);
        }

        $project->removeParticipant($member);
        $this->entityManager->flush();

        return $this->json([
            'memberId' => $memberId,
        ]);
    }

    #[Route('/{id}/invite', name: 'invite', methods: ['POST'])]
    #[IsGranted('ROLE_USER')]
    #[IsGranted('PROJECT_OWNER', subject: 'project')]
    public function invite(
        Project $project,
        #[MapRequestPayload] InviteMemberDTO $dto,
        MailerInterface $mailer,
        #[Autowire('%env(APP_NAME)%')] string $appName,
        #[Autowire('%env(NO_REPLY_EMAIL)%')] string $noReplyEmail,
    ) {
        $invitedUser = $this->entityManager->getRepository(User::class)
            ->findOneBy(['email' => $dto->email]);

        if ($invitedUser && $project->getParticipants()->contains($invitedUser)) {
            return $this->json(['message' => 'The user is already a participant of the project'], 400);
        }

        $existingInvitation = $this->entityManager->getRepository(ProjectInvitation::class)
            ->findOneBy([
                'project' => $project,
                'guestEmail' => $dto->email,
            ]);

        if ($existingInvitation && new \DateTime < (clone $existingInvitation->getCreatedAt())->modify('+7 days')) {
            return $this->json(['message' => 'A valid invitation has already been sent to this email for the specified project'], 400);
        }

        $invitation = new ProjectInvitation()
            ->setProject($project)
            ->setGuestEmail($dto->email);

        try {
            $mailer->send(new TemplatedEmail()
                ->from(new Address($noReplyEmail, $appName . ' No-Reply'))
                ->to(new Address($dto->email))
                ->subject('Invitation to join project "' . $project->getName() . '" on ' . $appName)
                ->htmlTemplate('emails/project_invitation.html.twig')
                ->context([
                    'project' => $project,
                    'invitation' => $invitation,
                ])
            );
        } catch (TransportExceptionInterface $exception) {
            return $this->json(['message' => 'Failed to send invitation email. Retry later or contact the site maintainer'], 500);
        }

        $this->entityManager->persist($invitation);
        $this->entityManager->flush();

        return $this->json(null, 201);
    }

    #[Route('/invitations/accept/{identifier:invitation}', name: 'accept_invitation')]
    #[NotValidateCsrfHeader]
    public function acceptInvitation(
        ?ProjectInvitation $invitation,
        SerializerInterface $serializer
    ) {
        if (! $invitation) {
            return $this->redirectToRoute('index', [
                'url' => '',
                'messages' => json_encode([
                    'error' => [
                        'Invalid invitation link.',
                    ],
                ]),
            ]);
        }

        $expirationDate = (clone $invitation->getCreatedAt())->modify('+7 days');

        if (new \DateTime > $expirationDate) {
            return $this->redirectToRoute('index', [
                'url' => '',
                'messages' => json_encode([
                    'error' => [
                        'This invitation has expired.',
                    ],
                ]),
            ]);
        }

        $user = $this->entityManager->getRepository(User::class)
            ->findOneBy(['email' => $invitation->getGuestEmail()]);

        if ($user) {
            $project = $invitation->getProject();
            $project->addParticipant($user);
            $this->entityManager->remove($invitation);
            $this->entityManager->flush();

            return $this->redirectToRoute('index', [
                'url' => "projects/{$project->getId()}",
                'messages' => json_encode([
                    'success' => [
                        "You have successfully joined the project '{$project->getName()}'.",
                    ],
                ]),
            ]);
        } else {
            return $this->redirectToRoute('index', [
                'url' => 'register',
                'email' => $invitation->getGuestEmail(),
                'messages' => json_encode([
                    'success' => [
                        'Please create an account first with this email address to be able to join the project.',
                    ],
                ]),
            ]);
        }
    }

    #[Route('/{id}/invitations', name: 'list_invitations', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    #[IsGranted('PROJECT_OWNER', subject: 'project')]
    public function listInvitations(
        Project $project
    ) {
        return $this->json(
            $project->getInvitations(),
            context: ['groups' => 'project_invitations:read']
        );
    }

    #[Route('/invitations/revoke', name: 'revoke_invitation', methods: ['POST'])]
    public function revokeInvitation(
        #[MapQueryParameter] int $id
    ) {
        $invitation = $this->entityManager->getRepository(ProjectInvitation::class)
            ->find($id);

        if (! $invitation) {
            return $this->json(['message' => 'Invitation not found'], 404);
        }

        $this->entityManager->remove($invitation);
        $this->entityManager->flush();

        return $this->json(null, 204);
    }
}
