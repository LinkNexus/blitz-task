<?php

namespace App\EventSubscriber;

use App\Event\SendVerificationMailEvent;
use App\Event\UserCreatedEvent;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

final readonly class UserCreationSubscriber implements EventSubscriberInterface
{
    public function __construct(
        private EventDispatcherInterface $eventDispatcher
    )
    {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            UserCreatedEvent::class => 'sendVerificationEmail',
        ];
    }

    public function sendVerificationEmail(UserCreatedEvent $event): void
    {
        $this->eventDispatcher->dispatch(new SendVerificationMailEvent($event->user));
    }
}
