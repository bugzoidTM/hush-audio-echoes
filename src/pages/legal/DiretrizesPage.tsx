import { LegalLayout, Secao } from './LegalLayout'

export default function DiretrizesPage() {
  return (
    <LegalLayout title="Diretrizes da Comunidade" updatedAt="23 de agosto de 2026" version="1.0">
      <p>
        O shhhh existe para que alguém consiga dizer em voz alta o que não diria em outro lugar. Isso só funciona
        se as pessoas se sentirem seguras. Estas diretrizes valem para todo Echo, resposta, Voice e bio.
      </p>

      <Secao titulo="O que não é permitido">
        <ul className="list-disc space-y-2 pl-5">
          <li><strong>Dados pessoais de terceiros:</strong> nome completo com endereço, telefone, CPF, local de trabalho, print de conversa identificável. Desabafar sobre alguém é permitido; expor essa pessoa não.</li>
          <li><strong>Ameaças e perseguição:</strong> ameaça de violência, incitação a agredir alguém, assédio direcionado, campanha contra uma pessoa específica.</li>
          <li><strong>Conteúdo sexual envolvendo menores:</strong> em qualquer forma, insinuação ou pedido. Removido e denunciado às autoridades.</li>
          <li><strong>Ódio:</strong> ataque a pessoas por raça, etnia, religião, deficiência, orientação sexual, identidade de gênero ou origem.</li>
          <li><strong>Instruções para crimes graves:</strong> fabricação de armas ou explosivos, tráfico, fraude.</li>
          <li><strong>Fingir ser outra pessoa</strong> real, com intenção de enganar.</li>
          <li><strong>Spam</strong> e divulgação repetitiva.</li>
        </ul>
      </Secao>

      <Secao titulo="Sofrimento e autoagressão">
        <p>
          Falar sobre dor, luto, depressão ou vontade de desistir <strong>é permitido</strong> — é para isso que
          muita gente chega aqui. O que não é permitido é incentivar, instruir ou romantizar a autoagressão.
        </p>
        <p>
          Echoes com sinais de risco à vida vão para revisão humana antes de aparecer no Discovery. Se você está em
          sofrimento agudo, o <strong>CVV (188)</strong> atende de graça, 24 horas por dia, em todo o Brasil.
        </p>
      </Secao>

      <Secao titulo="O que acontece quando algo é denunciado">
        <p>
          Toda denúncia entra numa fila revisada por pessoas. A decisão pode ser: manter, limitar o alcance (o Echo
          sai do Discovery mas o link continua valendo), recusar (sai do ar e a mídia é apagada), suspender a Voice
          ou suspender a conta. Você pode denunciar pelo ícone de bandeira em qualquer Echo.
        </p>
      </Secao>

      <Secao titulo="Antes de publicar, lembre">
        <p>
          Publicar como anônimo esconde você das <em>outras pessoas</em>, não do serviço — e o Protect My Voice
          dificulta o reconhecimento da sua voz, mas não o torna impossível. Se o que você vai contar puder te
          prejudicar caso alguém descubra quem é, pense duas vezes antes de tocar em publicar.
        </p>
      </Secao>
    </LegalLayout>
  )
}
