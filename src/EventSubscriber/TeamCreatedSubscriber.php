<?php

namespace App\EventSubscriber;

use App\Entity\Project;
use App\Event\ProjectCreatedEvent;
use App\Event\TeamCreatedEvent;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\EventDispatcher\EventDispatcherInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;

final readonly class TeamCreatedSubscriber implements EventSubscriberInterface
{
    public function __construct(private EventDispatcherInterface $eventDispatcher, private EntityManagerInterface $entityManager)
    {
    }

    public static function getSubscribedEvents(): array
    {
        return [
            TeamCreatedEvent::class => 'createDefaultProject',
        ];
    }

    public function createDefaultProject(TeamCreatedEvent $event): void
    {
        $team = $event->team;
        $defaultProject = new Project()
            ->setName($team->getName())
            ->setIsDefault(true)
            ->setTeam($team);

        $this->entityManager->persist($defaultProject);
        $this->entityManager->flush();
        $this->eventDispatcher->dispatch(new ProjectCreatedEvent($defaultProject, $event->defaultTask));
    }
}
