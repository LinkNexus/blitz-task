<?php

namespace App\EventSubscriber;

use App\Event\SendVerificationMailEvent;
use App\Event\UserCreatedEvent;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

class UserCreatedSubscriber implements EventSubscriberInterface
{
    public function __construct(private readonly EventDispatcherInterface $eventDispatcher) {}

    public function sendVerificationMail(UserCreatedEvent $event): void
    {
        $this->eventDispatcher->dispatch(new SendVerificationMailEvent($event->user));
    }

    public static function getSubscribedEvents(): array
    {
        return [
            UserCreatedEvent::class => 'sendVerificationMail',
        ];
    }
}
