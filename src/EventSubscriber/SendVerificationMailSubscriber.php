<?php

namespace App\EventSubscriber;

use App\Event\SendVerificationMailEvent;
use App\Security\EmailVerifier;
use Symfony\Bridge\Twig\Mime\TemplatedEmail;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\Mime\Address;

readonly class SendVerificationMailSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private EmailVerifier                               $emailVerifier,
        #[Autowire('%env(APP_NAME)%')] private string       $appName,
        #[Autowire('%env(NO_REPLY_EMAIL)%')] private string $noReplyEmail,
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
        $this->emailVerifier->sendEmailConfirmation('api.verify_email',
            $event->user,
            new TemplatedEmail()
                ->from(new Address($this->noReplyEmail, $this->appName . ' No-Reply'))
                ->to(new Address($event->user->getEmail(), $event->user->getName()))
                ->subject('Registration Confirmation to ' . $this->appName)
                ->htmlTemplate('emails/registration_confirmation.html.twig')
        );
    }
}
