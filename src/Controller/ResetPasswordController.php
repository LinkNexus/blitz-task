<?php

namespace App\Controller;

use App\DTO\UserDTO;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use JsonException;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface;
use SymfonyCasts\Bundle\ResetPassword\Controller\ResetPasswordControllerTrait;
use SymfonyCasts\Bundle\ResetPassword\Exception\ResetPasswordExceptionInterface;
use SymfonyCasts\Bundle\ResetPassword\ResetPasswordHelperInterface;

#[Route('/api/reset-password', name: 'api.reset_password.')]
final class ResetPasswordController extends AbstractController
{
    use ResetPasswordControllerTrait;

    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly ResetPasswordHelperInterface $resetPasswordHelper,
        private readonly MailerInterface $mailer,
        private readonly UrlGeneratorInterface $urlGenerator,
    ) {}

    #[Route('', name: 'request', methods: ['POST'])]
    public function request(Request $request): JsonResponse
    {
        try {
            $decodedContent = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $e) {
            return $this->json([
                'error' => 'Malformed JSON: ' . $e->getMessage(),
            ], Response::HTTP_BAD_REQUEST);
        }
        if (is_null($decodedContent) || ! property_exists($decodedContent, 'email')) {
            return $this->json([
                'error' => "Invalid JSON or missing 'email' property.",
            ], Response::HTTP_BAD_REQUEST);
        }

        return $this->processSendingPasswordResetEmail($decodedContent->email);
    }

    private function processSendingPasswordResetEmail(string $email): JsonResponse
    {
        $user = $this->entityManager->getRepository(User::class)->findOneBy([
            'email' => $email,
        ]);

        // Do not reveal whether a user account was found or not.
        if (! $user) {
            return $this->json([
                'resetToken' => $this->resetPasswordHelper->generateFakeResetToken(),
            ]);
        }

        try {
            $resetToken = $this->resetPasswordHelper->generateResetToken($user);
        } catch (ResetPasswordExceptionInterface $e) {
            return $this->json([
                'error' => sprintf(
                    '%s - %s',
                    ResetPasswordExceptionInterface::MESSAGE_PROBLEM_HANDLE,
                    $e->getReason()
                ),
            ], Response::HTTP_BAD_REQUEST);
        }

        $email = new TemplatedEmail()
            ->from(new Address('noreply@blitz-task.app', 'Blitz-Task No-Reply'))
            ->to((string) $user->getEmail())
            ->subject('Your password reset request')
            ->htmlTemplate('emails/reset_password_email.html.twig')
            ->context([
                'reset_password_url' => $this->urlGenerator
                    ->generate('api.reset_password.store_token', ['token' => $resetToken->getToken()],
                        UrlGeneratorInterface::ABSOLUTE_URL),
                'resetToken' => $resetToken,
            ]);

        $this->mailer->send($email);

        // Store the token object in session for retrieval in the check-email route.
        $this->setTokenObjectInSession($resetToken);

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    #[Route('/store-token/{token}', name: 'store_token', methods: ['GET'])]
    public function storeResetToken(
        string $token
    ): Response {
        // We store the token in session and remove it from the URL, to avoid the URL being
        // loaded in a browser and potentially leaking the token to 3rd party JavaScript.
        $this->storeTokenInSession($token);

        return $this->redirect('/reset-password');
    }

    #[Route('/reset', name: 'reset', methods: ['POST'])]
    public function reset(
        UserPasswordHasherInterface $passwordHasher,
        #[MapRequestPayload(
            validationGroups: ['password']
        )] UserDTO $userDTO
    ): JsonResponse {
        $token = $this->getTokenFromSession();

        if ($token === null) {
            throw $this->createNotFoundException('No reset password token found in the URL or in the session.');
        }

        try {
            /** @var User $user */
            $user = $this->resetPasswordHelper->validateTokenAndFetchUser($token);
        } catch (ResetPasswordExceptionInterface $e) {
            return $this->json([
                'error' => sprintf(
                    '%s - %s',
                    ResetPasswordExceptionInterface::MESSAGE_PROBLEM_VALIDATE,
                    $e->getReason()
                ),
            ]);
        }

        $this->resetPasswordHelper->removeResetRequest($token);
        $user->setPassword($passwordHasher->hashPassword($user, $userDTO->password));
        $this->entityManager->flush();

        $this->cleanSessionAfterReset();

        return $this->json(null, Response::HTTP_NO_CONTENT);
    }
}
