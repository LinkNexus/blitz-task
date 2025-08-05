<?php

namespace App\Security\Authentication;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use KnpU\OAuth2ClientBundle\Client\ClientRegistry;
use KnpU\OAuth2ClientBundle\Security\Authenticator\OAuth2Authenticator;
use League\OAuth2\Client\Provider\GithubResourceOwner;
use League\OAuth2\Client\Provider\GoogleUser;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Exception\AuthenticationException;
use Symfony\Component\Security\Http\Authenticator\Passport\Badge\UserBadge;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;
use Symfony\Component\Security\Http\Authenticator\Passport\SelfValidatingPassport;

class OAuthAuthenticator extends OAuth2Authenticator
{

    public function __construct(
        private readonly ClientRegistry         $clientRegistry,
        private readonly EntityManagerInterface $entityManager,
    )
    {
    }

    /**
     * @inheritDoc
     */
    public function supports(Request $request): ?bool
    {
        return "api.auth.oauth_check" === $request->attributes->get('_route')
            && in_array($request->get("service"), ["github", "google"]);
    }

    /**
     * @inheritDoc
     */
    public function authenticate(Request $request): Passport
    {
        $service = $request->get("service");
        $client = $this->clientRegistry->getClient($service);
        $accessToken = $this->fetchAccessToken($client);

        $resourceOwner = $client->fetchUserFromToken($accessToken);
        $email = null;
        $name = null;

        if ($resourceOwner instanceof GithubResourceOwner) {
            $email = $resourceOwner->getEmail();
            $name = $resourceOwner->getName();
        }

        if ($resourceOwner instanceof GoogleUser) {
            $email = $resourceOwner->getEmail();
            $name = $resourceOwner->getName();
        }

        if (!$email) {
            throw new AuthenticationException('Unable to get email from OAuth provider');
        }

        $user = $this->entityManager->getRepository(User::class)->findOneBy([
            "{$service}Id" => $resourceOwner->getId(),
        ]);
        if (null !== $user) {
            return new SelfValidatingPassport(new UserBadge($accessToken->getToken(), function () use ($user) {
                return $user;
            }));
        }

        $user = $this->entityManager->getRepository(User::class)->findOneBy([
            'email' => $email,
        ]);
        if ($user === null) {
            $user = new User();
            $this->entityManager->persist($user);
        }
        if (!$user->getName() && $name) {
            $user->setName($name);
        }
        $user->setEmail($email);

        // Set the OAuth service ID based on the service
        if ($service === 'github') {
            $user->setGithubId($resourceOwner->getId());
        }

        if ($service === 'google') {
            $user->setGoogleId($resourceOwner->getId());
        }

        if (!$user->isVerified()) {
            $user->setIsVerified(true);
        }

        $this->entityManager->flush();
        return new SelfValidatingPassport(new UserBadge($accessToken->getToken(), function () use ($user) {
            return $user;
        }));
    }

    /**
     * @inheritDoc
     */
    public function onAuthenticationSuccess(Request $request, TokenInterface $token, string $firewallName): ?Response
    {
        dump($token->getUser());
        return new RedirectResponse("/dashboard");
    }

    /**
     * @inheritDoc
     */
    public function onAuthenticationFailure(Request $request, AuthenticationException $exception): ?Response
    {
        // Simply redirect to login with error - the frontend can handle the error display
        return new RedirectResponse("/login?error=oauth_failed");
    }
}
