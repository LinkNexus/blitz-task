<?php

namespace App\Security\Auth;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use KnpU\OAuth2ClientBundle\Client\ClientRegistry;
use KnpU\OAuth2ClientBundle\Security\Authenticator\OAuth2Authenticator;
use League\OAuth2\Client\Provider\GoogleUser;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;

class OauthLoginAuthenticator extends OAuth2Authenticator
{
    public function __construct(
        private readonly ClientRegistry $clientRegistry,
        private readonly EntityManagerInterface $entityManager,
    ) {}

    public function supports(Request $request): ?bool
    {
        return $request->attributes->get('_route') === 'api.oauth_check'
        && in_array($request->get('service'), ['google']);
    }

    public function authenticate(Request $request): Passport
    {
        $service = $request->get('service');
        $client = $this->clientRegistry->getClient($service);
        $accessToken = $this->fetchAccessToken($client);

        $resourceOwner = $client->fetchUserFromToken($accessToken);
        $email = null;
        $name = null;

        if ($resourceOwner instanceof GoogleUser) {
            $email = $resourceOwner->getEmail();
            $name = $resourceOwner->getName();
        }

        if (! $email) {
            throw new AuthenticationException('Unable to get the email from the oauth provider');
        }

        $user = $this->entityManager->getRepository(User::class)
            ->findOneBy(["{$service}Id" => $resourceOwner->getId()]);

        if ($user !== null) {
            return new SelfValidatingPassport(
                new UserBadge($accessToken->getToken(), fn () => $user)
            );
        }

        $user = $this->entityManager->getRepository(User::class)
            ->findOneBy(['email' => $email]);

        if ($user === null) {
            $user = new User;
            $this->entityManager->persist($user);
        }

        if (! $user->getName() && $name) {
            $user->setName($name);
        }

        $user->setEmail($email);

        if ($service === 'google') {
            $user->setGoogleId($resourceOwner->getId());
        }

        if (! $user->isVerified()) {
            $user->setIsVerified(true);
        }

        $this->entityManager->flush();

        return new SelfValidatingPassport(
            new UserBadge($accessToken->getToken(), fn () => $user)
        );
    }

    public function onAuthenticationSuccess(Request $request, \Symfony\Component\Security\Core\Authentication\Token\TokenInterface $token, string $firewallName): ?\Symfony\Component\HttpFoundation\Response
    {
        return new RedirectResponse('/');
    }

    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?\Symfony\Component\HttpFoundation\Response
    {
        return new RedirectResponse('/login');
    }
}
