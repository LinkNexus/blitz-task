<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpKernel\Attribute\MapQueryParameter;
use Symfony\Component\HttpKernel\Attribute\MapUploadedFile;
use Symfony\Component\Routing\Attribute\Route;

#[Route("/api/attachments", name: "api.attachments.")]
final class AttachmentsController extends AbstractController
{
    #[Route('/upload', name: 'upload')]
    public function upload(
        #[MapQueryParameter] int        $taskId,
        #[MapUploadedFile] UploadedFile ...$files
    )
    {

    }
}
