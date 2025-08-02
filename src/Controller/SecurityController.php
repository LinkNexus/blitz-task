<?php

namespace App\Controller;

use App\DTO\CreateUserDTO;
use App\Entity\User;
use App\Event\SendVerificationMailEvent;
use App\Security\Authentication\JsonLoginAuthenticator;
use App\Security\LoginFormAuthenticator;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Bundle\SecurityBundle\Security;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\ObjectMapper\ObjectMapperInterface;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;

#[Route("/api/auth", name: "api.auth.", format: "json")]
final class SecurityController extends AbstractController
{
    public function __construct(
        private readonly EntityManagerInterface $entityManager,
        private readonly EventDispatcherInterface $eventDispatcher,
    )
    {
    }

    #[Route("/login", name: "login", methods: ["POST"])]
    public function login()
    {
        throw new \LogicException("This method should never be called, as the authenticator will handle the login process.");
    }

    #[Route("/logout", name: "logout", methods: ["DELETE"])]
    public function logout()
    {
        throw new \LogicException("This method should never be called, as the authenticator will handle the logout process.");
    }

    #[Route(path: "/register", name: "register", methods: ["POST"])]
    public function register(
        #[MapRequestPayload] CreateUserDTO $userDTO,
        Security                  $security,
        UserPasswordHasherInterface $passwordHasher,
        ObjectMapperInterface $mapper
    ): Response
    {
        if ($this->entityManager->getRepository(User::class)->findOneBy(['email' => $userDTO->email])) {
            return $this->json([
                "violations" => [
                    [
                        "propertyPath" => "email",
                        "title" => "This email is already in use by another account."
                    ]
                ]
            ], Response::HTTP_BAD_REQUEST);
        }

        $user = $mapper->map($userDTO, User::class);
        $user->setPassword($passwordHasher->hashPassword($user, $user->getPassword()));
        $this->entityManager->persist($user);
        $this->entityManager->flush();
        $this->entityManager->refresh($user);

//        $this->eventDispatcher->dispatch(new SendVerificationMailEvent($user));
        return $security->login($user, JsonLoginAuthenticator::class, "main");
    }
}
