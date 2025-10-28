<?php

namespace App\Service;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Path;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\String\Slugger\SluggerInterface;

final readonly class FileUploader
{
    public function __construct(
        #[Autowire('%kernel.project_dir%/uploads')] private string $uploadDir,
        private SluggerInterface $slugger,
    ) {}

    public function upload(
        UploadedFile $file,
        string $targetDir = '',
    ) {

        $originalFilename = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $safeFilename = $this->slugger->slug($originalFilename);
        $extension = $file->guessExtension();
        $filename = $safeFilename . '-' . uniqid() . '.' . $extension;

        $path = Path::join($this->uploadDir, $targetDir);
        $file->move($path, $filename);

        return [
            'filename' => $filename,
            'originalFilename' => $originalFilename . '.' . $extension,
        ];
    }
}
