param(
  [string]$Root = (Get-Location).Path,
  [int]$Port = 8787
)

$server = [System.Net.Sockets.TcpListener]::new([Net.IPAddress]::Parse("127.0.0.1"), $Port)
$server.Start()
Write-Host "Serving $Root at http://127.0.0.1:$Port/"

try {
  while ($true) {
    $client = $server.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [IO.StreamReader]::new($stream)
      $line = $reader.ReadLine()
      while ($reader.Peek() -ge 0) {
        $header = $reader.ReadLine()
        if ($header -eq "") { break }
      }

      $path = "index.html"
      if ($line -match "GET /([^ ]*)") {
        $path = [Uri]::UnescapeDataString($Matches[1])
        if ([string]::IsNullOrWhiteSpace($path)) { $path = "index.html" }
      }

      $file = [IO.Path]::GetFullPath([IO.Path]::Combine($Root, $path))
      if ($file.StartsWith($Root) -and [IO.File]::Exists($file)) {
        $bytes = [IO.File]::ReadAllBytes($file)
        $type = "application/octet-stream"
        if ($file.EndsWith(".html")) { $type = "text/html" }
        elseif ($file.EndsWith(".js")) { $type = "text/javascript" }
        elseif ($file.EndsWith(".css")) { $type = "text/css" }
        elseif ($file.EndsWith(".svg")) { $type = "image/svg+xml" }
        $head = "HTTP/1.1 200 OK`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
        $headBytes = [Text.Encoding]::ASCII.GetBytes($head)
        $stream.Write($headBytes, 0, $headBytes.Length)
        $stream.Write($bytes, 0, $bytes.Length)
      } else {
        $body = [Text.Encoding]::UTF8.GetBytes("not found")
        $head = "HTTP/1.1 404 Not Found`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
        $headBytes = [Text.Encoding]::ASCII.GetBytes($head)
        $stream.Write($headBytes, 0, $headBytes.Length)
        $stream.Write($body, 0, $body.Length)
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $server.Stop()
}
