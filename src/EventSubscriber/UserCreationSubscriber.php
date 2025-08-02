<?php

namespace App\EventSubscriber;

use App\Event\UserCreatedEvent;
use App\Security\EmailVerifier;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Mime\Address;

readonly class UserCreationSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private EmailVerifier $emailVerifier
    )
    {
    }

    public function sendVerificationEmail(UserCreatedEvent $event): void
    {
        $this->emailVerifier->sendEmailConfirmation(
            "api.auth.verify_email",
            $event->user,
            (new TemplatedEmail)
                ->to(new Address($event->user->getEmail(), $event->user->getName()))
                ->subject("Registration Confirmation to BlitzTask!")
                ->htmlTemplate("auth/registration_email.html.twig")
        );
    }

    public static function getSubscribedEvents(): array
    {
        return [
            UserCreatedEvent::class => 'sendVerificationEmail',
        ];
    }
}
