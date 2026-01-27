$ErrorActionPreference = 'Stop'

Write-Output '== Registrando profissional =='
$profBody = @{ nome='Prof Eletric Test'; idade=35; cidade='CidadeX'; estado='SP'; tipo='trabalhador'; atuacao='Eletricista'; telefone='11999999999'; descricao='Prof teste'; email='proftest1@example.com'; senha='senha123'; tema='light' } | ConvertTo-Json
$profResp = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/cadastro' -ContentType 'application/json' -Body $profBody
$profResp | ConvertTo-Json
$profToken = $profResp.token

Write-Output '== Registrando cliente =='
$cliBody = @{ nome='Cliente Test'; idade=28; cidade='CidadeX'; estado='SP'; tipo='cliente'; telefone='1188888888'; descricao='Cliente teste'; email='clientetest1@example.com'; senha='senha123'; tema='light' } | ConvertTo-Json
$cliResp = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/cadastro' -ContentType 'application/json' -Body $cliBody
$cliResp | ConvertTo-Json
$cliToken = $cliResp.token

Write-Output '== Atualizando localizacao do profissional =='
$locBody = @{ latitude = -23.55; longitude = -46.63 } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri 'http://localhost:3000/api/user/localizacao' -Headers @{ Authorization = "Bearer $profToken" } -ContentType 'application/json' -Body $locBody | ConvertTo-Json

Write-Output '== Setando disponivelAgora true para profissional =='
$dispBody = @{ disponivelAgora = $true } | ConvertTo-Json
Invoke-RestMethod -Method Put -Uri 'http://localhost:3000/api/user/disponibilidade' -Headers @{ Authorization = "Bearer $profToken" } -ContentType 'application/json' -Body $dispBody | ConvertTo-Json

Write-Output '== Cliente criando pedido urgente =='
$pedidoBody = @{ servico='Conserto quadro'; descricao='Teste pedido urgente eletricista'; localizacao = @{ endereco='Rua Teste, 1'; cidade='CidadeX'; estado='SP'; latitude=-23.55; longitude=-46.63 }; categoria='eletricista' } | ConvertTo-Json -Depth 5
$createPedido = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/pedidos-urgentes' -Headers @{ Authorization = "Bearer $cliToken" } -ContentType 'application/json' -Body $pedidoBody
$createPedido | ConvertTo-Json

Write-Output '== Profissional consultando notificacoes =='
$notifs = Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/notificacoes' -Headers @{ Authorization = "Bearer $profToken" }
$notifs | ConvertTo-Json

Write-Output '=== FIM ==='
