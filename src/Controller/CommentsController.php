<?php

namespace App\Controller;

use App\Entity\Comment;
use App\Entity\Task;
use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Attribute\MapRequestPayload;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\CurrentUser;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route("/api/comments", name: "api.comments.", format: "json")]
#[IsGranted("IS_AUTHENTICATED_FULLY")]
final class CommentsController extends AbstractController
{
    public function __construct(private readonly EntityManagerInterface $entityManager)
    {
    }

    #[Route("", name: "create", methods: ["POST"])]
    public function create(
        #[MapRequestPayload] Comment $comment,
        #[MapQueryParameter] int     $taskId,
        #[CurrentUser] User          $user
    ): JsonResponse
    {
        $task = $this->entityManager
            ->getRepository(Task::class)
            ->findWithTeam($taskId);

        if (!$task) {
            return $this->json([
                "message" => "The task with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $this->denyAccessUnlessGranted("TEAM_MEMBER", $task->getProject()->getTeam());

        $comment->setTask($task);
        $comment->setAuthor($user);

        $this->entityManager->persist($comment);
        $this->entityManager->flush();
        return $this->json($comment, Response::HTTP_CREATED, context: ["groups" => ["comments:read"]]);
    }

    #[Route("", name: "fetch", methods: ["GET"])]
    public function fetch(
        #[MapQueryParameter] int $taskId,
    ): JsonResponse
    {
        $task = $this->entityManager
            ->getRepository(Task::class)
            ->findWithComments($taskId);

        if (!$task) {
            return $this->json([
                "message" => "The task with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        $this->denyAccessUnlessGranted("TEAM_MEMBER", $task->getProject()->getTeam());
        return $this->json($task->getComments(), context: ["groups" => ["comments:read"]]);
    }

    #[Route("/{id}", name: "delete", methods: ["DELETE"])]
    public function delete(
        int                 $id,
        #[CurrentUser] User $user
    ): JsonResponse
    {
        $comment = $this->entityManager
            ->getRepository(Comment::class)
            ->findWithAuthor($id);

        if (!$comment) {
            return $this->json([
                "message" => "The comment with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        if ($comment->getAuthor()->getId() !== $user->getId()) {
            return $this->json([
                "message" => "You are not allowed to delete this comment."
            ], Response::HTTP_FORBIDDEN);
        }

        $this->entityManager->remove($comment);
        $this->entityManager->flush();
        return $this->json(null, Response::HTTP_NO_CONTENT);
    }

    #[Route("/{id}", name: "update", methods: ["PATCH"])]
    public function update(
        Request             $request,
        int                 $id,
        #[CurrentUser] User $user
    ): JsonResponse
    {
        $comment = $this->entityManager
            ->getRepository(Comment::class)
            ->findWithAuthor($id);

        if (!$comment) {
            return $this->json([
                "message" => "The comment with the given ID does not exist."
            ], Response::HTTP_NOT_FOUND);
        }

        if ($comment->getAuthor()->getId() !== $user->getId()) {
            return $this->json([
                "message" => "You are not allowed to edit this comment."
            ], Response::HTTP_FORBIDDEN);
        }

        $payload = json_decode($request->getContent(), true);
        if (!array_key_exists("content", $payload)) {
            return $this->json([
                "message" => "The content field is required."
            ], Response::HTTP_BAD_REQUEST);
        }

        $comment->setContent($payload["content"]);
        $this->entityManager->flush();
        return $this->json($comment, Response::HTTP_OK, context: ["groups" => ["comments:read"]]);
    }
}
