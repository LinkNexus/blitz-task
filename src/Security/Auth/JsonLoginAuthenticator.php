<?php

namespace App\Security\Auth;

use App\Entity\User;
use App\Repository\UserRepository;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Core\Exception\BadCredentialsException;
use Symfony\Component\Security\Core\Exception\InvalidCsrfTokenException;
use Symfony\Component\Security\Core\Exception\TooManyLoginAttemptsAuthenticationException;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\CsrfTokenBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\RememberMeBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Credentials\PasswordCredentials;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\EntryPoint\AuthenticationEntryPointInterface;
use Symfony\Component\Serializer\SerializerInterface;

final class JsonLoginAuthenticator extends AbstractAuthenticator implements AuthenticationEntryPointInterface
{
    public function __construct(
        private readonly UserRepository $repository,
        private readonly SerializerInterface $serializer,
    ) {}

    public function supports(Request $request): ?bool
    {
        return $request->attributes->get('_route') === 'api.login' &&
        $request->isMethod('POST');
    }

    public function authenticate(Request $request): Passport
    {
        $data = json_decode($request->getContent(), true) ?? [];
        $xsrfToken = $request->headers->get('X-XSRF-TOKEN');

        if (! array_key_exists('email', $data) ||
            ! array_key_exists('password', $data)
        ) {
            throw new BadCredentialsException('Email and password are required.');
        }

        $badges = [];
        $badges[] = new CsrfTokenBadge('api', $xsrfToken);
        if (array_key_exists('remember_me', $data) && $data['remember_me'] === true) {
            $badges[] = new RememberMeBadge;
        }

        return new Passport(
            new UserBadge($data['email'], fn ($email) => $this->repository->findOneBy(['email' => $email])),
            new PasswordCredentials($data['password']),
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
                'message' => 'Too many login attempts. Please try again later.',
            ], Response::HTTP_TOO_MANY_REQUESTS);
        }

        if ($exception instanceof InvalidCsrfTokenException) {
            return new JsonResponse([
                'message' => 'Invalid CSRF token.',
            ], 419);
        }

        return new JsonResponse([
            'message' => strtr($exception->getMessageKey(), $exception->getMessageData()),
        ], Response::HTTP_UNAUTHORIZED);
    }

    public function start(Request $request, ?AuthenticationException $authException = null): Response
    {
        return new JsonResponse([
            'message' => 'Full authentication is required to access this resource',
        ], Response::HTTP_UNAUTHORIZED);
    }
}
