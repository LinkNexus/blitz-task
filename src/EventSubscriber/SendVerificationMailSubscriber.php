<?php

namespace App\EventSubscriber;

use App\Event\SendVerificationMailEvent;
use App\Security\EmailVerifier;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Mime\Address;

final readonly class SendVerificationMailSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private EmailVerifier $emailVerifier
    )
    {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            SendVerificationMailEvent::class => 'sendMail',
        ];
    }

    public function sendMail(SendVerificationMailEvent $event): void
    {
        $this->emailVerifier->sendEmailConfirmation(
            "api.auth.verify_email",
            $event->user,
            (new TemplatedEmail)
                ->from(new Address("noreply@blitz-task.app", "Blitz-Task No-Reply"))
                ->to(new Address($event->user->getEmail(), $event->user->getName()))
                ->subject("Registration Confirmation to Blitz-Task!")
                ->htmlTemplate("auth/registration_email.html.twig")
        );
    }
}
