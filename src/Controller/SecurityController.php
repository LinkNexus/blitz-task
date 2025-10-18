<?php

namespace App\Controller;

use App\Attribute\ValidateCsrfHeader;
use App\DTO\CreateUserDTO;
use App\Entity\User;
use App\Event\SendVerificationMailEvent;
use App\Event\UserCreatedEvent;
use App\Security\Auth\JsonLoginAuthenticator;
use App\Security\EmailVerifier;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\ObjectMapper\ObjectMapperInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use SymfonyCasts\Bundle\VerifyEmail\Exception\VerifyEmailExceptionInterface;

#[Route('/api', name: 'api.')]
final class SecurityController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly EventDispatcherInterface $eventDispatcher,
        private readonly EmailVerifier $emailVerifier,
    ) {}

    #[Route('/csrf-token', name: 'csrf_token', methods: ['GET'])]
    public function getCsrfCookie(
        CsrfTokenManagerInterface $csrfTokenManager,
    ): JsonResponse {
        $csrfToken = $csrfTokenManager->getToken('api')->getValue();
        $cookie = Cookie::create('XSRF-TOKEN')
            ->withValue($csrfToken)
            ->withPath('/')
            ->withHttpOnly(false)
            ->withSecure(true)
            ->withSameSite('lax');

        $response = new JsonResponse;
        $response->headers->setCookie($cookie);

        return $response;
    }

    #[Route('/me', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function me(#[CurrentUser] User $user): JsonResponse
    {
        return $this->json($user, context: ['groups' => ['user:read']]);
    }

    #[Route('/login', name: 'login', methods: ['POST'])]
    public function login(): JsonResponse
    {
        throw new \LogicException(
            'This method should never be called, as the authenticator will handle the login process.',
        );
    }

    #[Route('/register', name: 'register', methods: ['POST'])]
    #[ValidateCsrfHeader]
    public function register(
        #[MapRequestPayload] CreateUserDTO $userDTO,
        Security $security,
        UserPasswordHasherInterface $passwordHasher,
        ObjectMapperInterface $objectMapper,
    ): JsonResponse {
        $user = $objectMapper->map($userDTO, User::class);
        $user->setPassword(
            $passwordHasher->hashPassword($user, $userDTO->password),
        );
        $this->entityManager->persist($user);
        $this->entityManager->flush();

        $this->eventDispatcher->dispatch(new UserCreatedEvent($user));

        return $security->login($user, JsonLoginAuthenticator::class, 'main');
    }

    #[IsGranted(['ROLE_USER'])]
    #[Route('/resend-verification-mail', name: 'resend_verification_mail', methods: ['POST'])]
    public function resendVerificationMail(#[CurrentUser] User $user): JsonResponse
    {
        if ($user->isVerified()) {
            return $this->json(true);
        }

        $this->eventDispatcher->dispatch(new SendVerificationMailEvent($user));

        return $this->json(false);
    }

    #[Route('/verify-email', name: 'verify_email', methods: ['GET'])]
    public function verifyEmail(
        #[CurrentUser] User $user,
        Request $request
    ): RedirectResponse {
        try {
            $this->emailVerifier->handleEmailConfirmation($request, $user);
        } catch (VerifyEmailExceptionInterface $exception) {
            $this->addFlash('error', $exception->getReason());

            return $this->redirect('/login');
        }

        $this->addFlash('success', 'Your email address has been verified.');

        return $this->redirect('/');
    }
}
