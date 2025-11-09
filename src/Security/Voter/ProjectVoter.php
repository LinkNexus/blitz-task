<?php

namespace App\Security\Voter;

use App\Entity\User;
use Symfony\Component\Security\Core\Authentication\Token\TokenInterface;
use Symfony\Component\Security\Core\Authorization\Voter\Voter;

/**
 * @extends Voter<string,Project>
 */
final class ProjectVoter extends Voter
{
    public const string PARTICIPANT = 'PROJECT_PARTICIPANT';

    public const string OWNER = 'PROJECT_OWNER';

    protected function supports(string $attribute, mixed $subject): bool
    {
        // replace with your own logic
        // https://symfony.com/doc/current/security/voters.html
        return in_array($attribute, [self::PARTICIPANT, self::OWNER])
            && $subject instanceof \App\Entity\Project;
    }

    protected function voteOnAttribute(string $attribute, mixed $subject, TokenInterface $token): bool
    {
        $user = $token->getUser();

        // if the user is anonymous, do not grant access
        if (! $user instanceof User) {
            return false;
        }

        // ... (check conditions and return true to grant permission) ...
        return match ($attribute) {
            self::PARTICIPANT => $subject->getParticipants()->contains($user),
            self::OWNER => $subject->getCreatedBy()->getId() === $user->getId(),
            default => false,
        };
    }
}
