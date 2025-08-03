<?php

namespace App\Security\Authentication;

use App\Entity\User;
use App\Repository\UserRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\RememberMeBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Credentials\PasswordCredentials;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\EntryPoint\AuthenticationEntryPointInterface;
use Symfony\Component\Serializer\SerializerInterface;

class JsonLoginAuthenticator extends AbstractAuthenticator implements AuthenticationEntryPointInterface
{

    public function __construct(
        private readonly UserRepository      $repository,
        private readonly SerializerInterface $serializer
    )
    {
    }

    public function start(Request $request, ?AuthenticationException $authException = null): Response
    {
        return new JsonResponse(['message' => 'Full Authentication is required to access this resource'], Response::HTTP_UNAUTHORIZED);
    }

    public function supports(Request $request): ?bool
    {
        return $request->attributes->get("_route") === "api.auth.login"
            && $request->isMethod("POST");
    }

    public function authenticate(Request $request): Passport
    {
        $data = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
        $email = $data['email'] ?? null;
        $password = $data['password'] ?? null;
        $rememberMe = $data['_remember_me'] ?? false;

        if (null === $email || null === $password) {
            throw new BadCredentialsException('Email and password must be provided');
        }

        $badges = [];
        if ($rememberMe) {
            $badges[] = new RememberMeBadge;
        }

        return new Passport(
            new UserBadge(
                $email,
                fn($email) => $this->repository->findOneBy(["email" => $email])
            ),
            new PasswordCredentials($password),
            $badges
        );
    }

    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        /** @var User $user */
        $user = $token->getUser();
        return new JsonResponse(
            $this->serializer->serialize($user, 'json', ['groups' => 'user:read']),
            Response::HTTP_OK,
            json: true
        );
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        if ($exception instanceof TooManyLoginAttemptsAuthenticationException) {
            return new JsonResponse([
                "message" => "Too many login attempts. Please try again later."
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        $data = [
            // you may want to customize or obfuscate the message first
            'message' => strtr($exception->getMessageKey(), $exception->getMessageData()),

            // or to translate this message
            // $this->translator->trans($exception->getMessageKey(), $exception->getMessageData())
        ];

        return new JsonResponse($data, Response::HTTP_UNAUTHORIZED);
    }
}
