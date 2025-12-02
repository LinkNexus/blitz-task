<?php

namespace App\EventSubscriber;

use App\Attribute\ValidateCsrfHeader;
use ReflectionMethod;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ControllerEvent;
use Symfony\Component\Security\Csrf\CsrfToken;
use Symfony\Component\Security\Csrf\CsrfTokenManagerInterface;

class CsrfHeaderValidationSubscriber implements EventSubscriberInterface
{
    public function __construct(private readonly CsrfTokenManagerInterface $csrfTokenManager) {}

    public function validateCsrfHeader(ControllerEvent $event): void
    {
        $controller = $event->getController();

        if (! is_array($controller)) {
            return;
        }

        [$controllerObject, $methodName] = $controller;
        $reflection = new ReflectionMethod($controllerObject, $methodName);

        $attributes = array_merge(
            $reflection->getAttributes(ValidateCsrfHeader::class),
            $reflection->getDeclaringClass()->getAttributes(ValidateCsrfHeader::class)
        );

        $excluded = $reflection->getAttributes(\App\Attribute\NotValidateCsrfHeader::class);

        if (! $attributes) {
            return;
        }

        /** @var ValidateCsrfHeader $config */
        $config = $attributes[0]->newInstance();

        $request = $event->getRequest();
        $token = $request->headers->get('X-XSRF-TOKEN');

        if (is_array($excluded) && count($excluded) !== 0) {
            return;
        }

        if (! $token) {
            $event->setController(fn () => new JsonResponse(['message' => 'Missing CSRF token.'], 419));

            return;
        }

        if (! $this->csrfTokenManager->isTokenValid(new CsrfToken($config->tokenId, $token))) {
            $event->setController(fn () => new JsonResponse(['message' => 'Invalid CSRF token.'], 419));

            return;
        }
    }

    public static function getSubscribedEvents(): array
    {
        return [
            ControllerEvent::class => 'validateCsrfHeader',
        ];
    }
}
