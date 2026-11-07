$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$mysqlRoot = Join-Path $projectRoot '.local/mysql'
$dataPath = Join-Path $mysqlRoot 'data'
$server = (Get-Command mysqld.exe -ErrorAction Stop).Source
$marker = Join-Path $mysqlRoot 'instance.json'
New-Item -ItemType Directory -Path $mysqlRoot -Force | Out-Null
if (!(Test-Path -LiteralPath $marker)) {
  if (Test-Path -LiteralPath $dataPath) { throw '已有未知数据目录，拒绝初始化' }
  @{identity='maozhi-isolated-mysql8'; root=$mysqlRoot} | ConvertTo-Json | Set-Content $marker -Encoding utf8
}
$instance = Get-Content -Raw $marker | ConvertFrom-Json
if ($instance.identity -ne 'maozhi-isolated-mysql8' -or $instance.root -ne $mysqlRoot) { throw '实例身份不匹配' }
$running = Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue
if ($running) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($running[0].OwningProcess)"
  if ($process.CommandLine -notlike "*$mysqlRoot*") { throw '3307被其他实例占用' }
  if (Test-Path -LiteralPath (Join-Path $mysqlRoot 'admin.json')) {
    Write-Output '项目 MySQL 已运行于 127.0.0.1:3307'
    exit 0
  }
  Stop-Process -Id $process.ProcessId
  Wait-Process -Id $process.ProcessId -ErrorAction SilentlyContinue
}
$slashRoot = $mysqlRoot.Replace('\','/')
@"
[mysqld]
port=3307
bind-address=127.0.0.1
datadir=$slashRoot/data
log-error=$slashRoot/error.log
pid-file=$slashRoot/server.pid
mysqlx=0
skip-name-resolve
character-set-server=utf8mb4
collation-server=utf8mb4_0900_bin
default-time-zone=+00:00
sql-mode=STRICT_ALL_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
innodb-lock-wait-timeout=5
"@ | Set-Content (Join-Path $mysqlRoot 'my.ini') -Encoding utf8
$config = Join-Path $mysqlRoot 'my.ini'
if (!(Test-Path -LiteralPath (Join-Path $dataPath 'mysql'))) {
  & $server "--defaults-file=$config" --initialize-insecure
  if ($LASTEXITCODE -ne 0) { throw '独立实例初始化失败，查看 .local/mysql/error.log' }
}
$arguments = @("--defaults-file=$config")
$adminPath = Join-Path $mysqlRoot 'admin.json'
if (!(Test-Path -LiteralPath $adminPath)) {
  $password = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  @{host='127.0.0.1';port=3307;user='root';password=$password} | ConvertTo-Json | Set-Content $adminPath -Encoding utf8
  $initPath = Join-Path $mysqlRoot 'bootstrap.sql'
  @"
CREATE USER IF NOT EXISTS 'root'@'127.0.0.1' IDENTIFIED BY '$password';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'127.0.0.1' WITH GRANT OPTION;
ALTER USER 'root'@'localhost' IDENTIFIED BY '$password';
"@ | Set-Content $initPath -Encoding utf8
  $arguments += "--init-file=$initPath"
}
Start-Process -FilePath $server -ArgumentList $arguments -WindowStyle Hidden | Out-Null
for ($attempt=0; $attempt -lt 40; $attempt++) {
  if (Get-NetTCPConnection -LocalPort 3307 -State Listen -ErrorAction SilentlyContinue) {
    Write-Output '独立 MySQL 8 已启动；执行 npm run db:setup 初始化专用开发账户'
    exit 0
  }
  Start-Sleep -Milliseconds 500
}
throw '实例启动超时，查看 .local/mysql/error.log'
