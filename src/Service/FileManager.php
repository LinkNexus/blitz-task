<?php

namespace App\Service;

use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\Filesystem\Exception\IOException;
use Symfony\Component\Filesystem\Filesystem;
use Symfony\Component\Filesystem\Path;
use Symfony\Component\HttpFoundation\File\Exception\FileException;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\String\Slugger\SluggerInterface;

final readonly class FileManager
{

    public function __construct(
        #[Autowire("%kernel.project_dir%/uploads")] private string $uploadsDir,
        private SluggerInterface                                   $slugger,
        private Filesystem                                         $filesystem
    )
    {
    }


    /**
     * Handles the upload of a file to a specified target directory.
     *
     * @param UploadedFile $file The file to be uploaded.
     * @param string $targetDir The target directory where the file will be uploaded.
     *
     * @return array An array containing the file name and original file name.
     *
     * @throws FileException If there is an error during the file upload process.
     */
    public function upload(
        UploadedFile $file,
        string       $targetDir = "",
    ): array
    {
        $originalFilename = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $safeFilename = $this->slugger->slug($originalFilename);
        $extension = $file->guessExtension();
        $filename = $safeFilename . '-' . uniqid() . '.' . $extension;

        $path = Path::join($this->uploadsDir, $targetDir);
        $file->move($path, $filename);

        return [
            "filename" => $filename,
            "originalName" => $originalFilename . '.' . $extension,
        ];
    }

    /**
     * Deletes a file from the uploads directory.
     *
     * @param string $filename The name of the file to be deleted.
     *
     * @return void
     *
     * @throws IOException If there is an error during the file deletion process.
     */
    public function delete(string $filename): void
    {
        $path = Path::join($this->uploadsDir, $filename);
        $this->filesystem->remove($path);
    }
}
