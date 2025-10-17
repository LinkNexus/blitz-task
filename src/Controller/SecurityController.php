<?php

namespace App\Controller;

use App\Entity\User;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api', name: 'api.')]
final class SecurityController extends AbstractController
{
    #[Route('/csrf-token', name: 'csrf_token', methods: ['GET'])]
    public function getCsrfCookie(CsrfTokenManagerInterface $csrfTokenManager): JsonResponse
    {
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
        throw new \LogicException('This method should never be called, as the authenticator will handle the login process.');
    }
}
