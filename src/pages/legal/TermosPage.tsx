import { Link } from 'react-router-dom'
import { LegalLayout, Secao } from './LegalLayout'

export default function TermosPage() {
  return (
    <LegalLayout title="Termos de Uso" updatedAt="23 de agosto de 2026" version="1.0">
      <p>
        O shhhh é uma rede social de áudio onde pessoas contam histórias, segredos e desabafos com a própria voz.
        Ao criar uma conta você concorda com estes Termos. Leia com atenção a seção sobre anonimato: ela descreve
        exatamente o que o shhhh sabe e o que não sabe sobre quem publica.
      </p>

      <Secao titulo="Quem pode usar">
        <p>
          É preciso ter <strong>18 anos ou mais</strong>. O shhhh reúne desabafos sobre relacionamentos, sexualidade,
          sofrimento emocional e outros assuntos adultos, publicados de forma anônima — não é um ambiente adequado
          para menores de idade.
        </p>
        <p>
          Ao criar a conta você declara ter 18 anos ou mais. Se soubermos que uma conta pertence a menor de idade,
          ela será suspensa e o conteúdo removido. Qualquer pessoa pode denunciar um Echo usando o motivo
          <strong> Segurança de menores</strong>, e essa denúncia tem prioridade na fila de revisão.
        </p>
      </Secao>

      <Secao titulo="O que “anônimo” significa aqui — e o que não significa">
        <p>
          Publicar como <strong>Anônimo</strong> significa que <strong>nenhuma outra pessoa</strong> vê sua Voice,
          seu @, seu avatar ou qualquer identificador da sua conta ligado àquele Echo. O endereço do arquivo de áudio
          também não contém nada que aponte para você.
        </p>
        <p>
          <strong>Não significa que o shhhh não saiba quem publicou.</strong> Internamente, todo Echo permanece
          vinculado à conta que o criou. Isso existe por três motivos: para você poder editar e apagar o que é seu;
          para a moderação conseguir agir contra quem usa o anonimato para ameaçar, expor dados de terceiros ou
          atacar alguém; e para cumprirmos obrigações legais quando formos obrigados a isso.
        </p>
        <p>
          Se você precisa de anonimato absoluto — inclusive perante quem opera o serviço — o shhhh não é a
          ferramenta certa.
        </p>
      </Secao>

      <Secao titulo="Protect My Voice">
        <p>
          O Protect My Voice altera características da sua gravação para dificultar o reconhecimento da sua voz.
          Ele <strong>reduz</strong> a chance de alguém te reconhecer; <strong>não garante</strong> anonimato
          absoluto. Quem já conhece sua voz, seu jeito de falar ou o conteúdo do que você conta ainda pode te
          identificar. Quando a proteção falha, o shhhh bloqueia a publicação em vez de enviar o áudio original.
        </p>
      </Secao>

      <Secao titulo="Seu conteúdo">
        <p>
          O que você grava continua sendo seu. Você nos concede permissão para armazenar, transmitir e exibir seus
          Echoes dentro do shhhh, para que outras pessoas possam ouvi-los — inclusive por link compartilhado, que
          funciona sem cadastro. Essa permissão termina quando o Echo expira ou é apagado.
        </p>
        <p>
          Echoes podem ter prazo de validade (1 hora, 6 horas, 24 horas, 7 dias ou permanente). Ao expirar, o arquivo
          de áudio é removido do armazenamento — não é apenas escondido.
        </p>
      </Secao>

      <Secao titulo="Moderação">
        <p>
          Nenhum Echo é publicado sem análise. O áudio enviado é transcrito no nosso servidor e classificado antes de
          aparecer no Discovery. O que a análise automática não libera vai para revisão humana. Podemos aprovar,
          limitar o alcance, recusar ou remover conteúdo, e suspender Voices e contas, conforme as
          <strong> Diretrizes da Comunidade</strong>.
        </p>
      </Secao>

      <Secao titulo="Encerramento">
        <p>
          Você pode apagar sua conta a qualquer momento em Configurações → Excluir minha conta. Podemos encerrar ou
          suspender contas que violem estes Termos ou as Diretrizes.
        </p>
      </Secao>

      <Secao titulo="Sem garantias e limites">
        <p>
          O shhhh é oferecido no estado em que se encontra. Não garantimos disponibilidade ininterrupta nem que
          conteúdo publicado por terceiros seja verdadeiro, apropriado ou seguro. Você é responsável pelo que
          publica.
        </p>
      </Secao>

      <Secao titulo="Mudanças e contato">
        <p>
          Podemos atualizar estes Termos. Mudanças relevantes serão avisadas dentro do produto. Contato:{' '}
          <Link className="font-semibold text-indigo-600 hover:underline" to="/contato">formulário de contato</Link>.
        </p>
      </Secao>
    </LegalLayout>
  )
}
