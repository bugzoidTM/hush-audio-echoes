import { Link } from 'react-router-dom'
import { LegalLayout, Secao } from './LegalLayout'

export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade" updatedAt="24 de agosto de 2026">
      <p>
        Esta política descreve quais dados o shhhh coleta, por que, por quanto tempo e como você exerce seus
        direitos. Ela é escrita para ser lida — sem parágrafos genéricos que valeriam para qualquer produto.
      </p>

      <Secao titulo="Quem é o controlador">
        <p>
          O shhhh é operado por Nutef. Contato para assuntos de privacidade e exercício de direitos:{' '}
          <Link className="font-semibold text-indigo-600 hover:underline" to="/contato">formulário de contato</Link>.
        </p>
      </Secao>

      <Secao titulo="O que coletamos">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Conta:</strong> e-mail, senha (armazenada com hash) e o nome que você escolhe no cadastro.</li>
          <li><strong>Voice:</strong> @, nome de exibição, bio e avatar, se você criar uma.</li>
          <li><strong>Echoes:</strong> o áudio, a duração, a categoria, o título e a descrição que você escrever.</li>
          <li><strong>Transcrição:</strong> o texto gerado <em>no nosso servidor</em> a partir do áudio publicado. Ele é a base da moderação e aparece no botão “Mostrar transcrição”.</li>
          <li><strong>Uso:</strong> eventos de reprodução (começou, 25%, 50%, 70%, concluiu, pulou), reações, respostas, follows e denúncias. Servem para ordenar o Discovery e detectar abuso.</li>
          <li><strong>Moderação:</strong> decisões, notas e o histórico das denúncias que envolvem seu conteúdo.</li>
        </ul>
        <p>
          Não pedimos telefone, documento, localização nem contatos da agenda. Não usamos rastreadores publicitários
          de terceiros.
        </p>
      </Secao>

      <Secao titulo="Anonimato: o que outras pessoas veem">
        <p>
          Num Echo anônimo, ninguém — nem quem ouve, nem quem recebe o link — vê sua Voice, seu @ ou qualquer dado
          da sua conta. Internamente, porém, <strong>o Echo continua vinculado à sua conta</strong>, para permitir
          que você o apague, para a moderação agir contra abusos e para cumprirmos obrigações legais. Isso está
          descrito também nos Termos, e é a diferença entre “anônimo perante outras pessoas” e “anônimo perante o
          serviço”.
        </p>
      </Secao>

      <Secao titulo="Quem mais tem acesso">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Qualquer pessoa com o link</strong> de um Echo aprovado pode ouvi-lo, mesmo sem conta — é assim que uma história chega a quem ainda não conhece o shhhh.</li>
          <li><strong>Buscadores:</strong> páginas de Echo são servidas com <code>noindex</code>, para que desabafos não fiquem arquivados no Google. Páginas de Voice também, durante o beta.</li>
          <li><strong>Moderação:</strong> pessoas com papel de moderação veem o áudio, a transcrição e a conta de origem do conteúdo que está na fila de revisão.</li>
          <li><strong>Infraestrutura:</strong> os dados ficam em servidor próprio no Brasil. A transcrição roda localmente, no nosso servidor — o áudio não é enviado a serviços de IA de terceiros.</li>
        </ul>
      </Secao>

      <Secao titulo="Por quanto tempo guardamos">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Echo com prazo:</strong> o arquivo de áudio é removido do armazenamento quando expira (1h, 24h ou 7 dias), por rotina automática que roda a cada 15 minutos.</li>
          <li><strong>Echo permanente:</strong> até você apagá-lo ou apagar sua conta.</li>
          <li><strong>Conta:</strong> enquanto existir. Ao excluí-la, os dados listados abaixo são removidos.</li>
          <li><strong>Registros de moderação de casos denunciados:</strong> podem ser conservados mesmo após a exclusão da conta, sem vínculo com você, quando forem necessários para proteger terceiros ou cumprir obrigação legal.</li>
        </ul>
      </Secao>

      <Secao titulo="Seus direitos">
        <p>
          A LGPD garante a você acesso, correção, anonimização, bloqueio, eliminação, portabilidade e informação
          sobre compartilhamento, além da revogação de consentimento quando for essa a base legal. No shhhh:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Acesso e portabilidade:</strong> Configurações → <em>Baixar meus dados</em>, que gera um arquivo JSON com conta, Voices, Echoes, transcrições, reações, follows e denúncias.</li>
          <li><strong>Correção:</strong> edite Voice e Echo dentro do produto.</li>
          <li><strong>Eliminação:</strong> Configurações → <em>Excluir minha conta</em>.</li>
          <li><strong>Demais pedidos:</strong> use o <Link className="font-semibold text-indigo-600 hover:underline" to="/contato">formulário de contato</Link>. Respondemos em até 15 dias.</li>
        </ul>
      </Secao>

      <Secao titulo="O que acontece ao excluir a conta">
        <p>Apagamos, imediatamente:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>seus Echoes (marcados como apagados e com a mídia removida do armazenamento na rotina seguinte);</li>
          <li>suas Voices;</li>
          <li>suas reações, follows, bloqueios, preferências, notificações e eventos de uso;</li>
          <li>sua conta de acesso e credenciais.</li>
        </ul>
        <p>
          Denúncias que você fez perdem o vínculo com você, mas o caso denunciado permanece na moderação: apagá-lo
          deixaria terceiros desprotegidos. Cópias já baixadas ou compartilhadas por outras pessoas fora do shhhh
          não estão ao nosso alcance.
        </p>
      </Secao>

      <Secao titulo="Segurança">
        <p>
          Senhas com hash, acesso ao banco com regras por linha, moderação obrigatória antes da publicação e limites
          por conta contra abuso. Nenhum sistema é infalível: se ocorrer incidente relevante com risco a você,
          comunicaremos você e a ANPD.
        </p>
      </Secao>

      <Secao titulo="Idade mínima">
        <p>O shhhh é para maiores de 18 anos. Não coletamos dados de menores conscientemente.</p>
      </Secao>
    </LegalLayout>
  )
}
