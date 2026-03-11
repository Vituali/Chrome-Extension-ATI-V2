;(function () {
  window.addEventListener('message', function handler(event) {
    if (!event.data || event.data.type !== 'ATI_SGP_FILL') return
    window.removeEventListener('message', handler)

    const data = event.data.data
    const username = event.data.username

    function setValue(selector, value) {
      try {
        const el = document.querySelector(selector)
        if (!el) return
        el.value = value
        el.dispatchEvent(new Event('change', { bubbles: true }))
      } catch(e) {}
    }

    function setCheck(selector, checked) {
      try {
        const el = document.querySelector(selector)
        if (!el) return
        el.checked = checked
        el.dispatchEvent(new Event('change', { bubbles: true }))
      } catch(e) {}
    }

    function fill() {
      const now = new Date()
      const pad = function(n) { return String(n).padStart(2, '0') }
      const dateStr = pad(now.getDate()) + '/' + pad(now.getMonth()+1) + '/' + now.getFullYear() + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())

      // Responsável por texto
      if (username) {
        const respSelect = document.querySelector('#id_responsavel')
        if (respSelect) {
          const match = Array.from(respSelect.options).find(function(o) {
            return o.textContent.toLowerCase().includes(username)
          })
          if (match) setValue('#id_responsavel', match.value)
        }
      }

      // Fixos
      setValue('#id_setor', '2')
      setValue('#id_metodo', '3')
      setValue('#id_data_agendamento', dateStr)

      // Contrato
      if (data.selectedContract) {
        setValue('#id_clientecontrato', data.selectedContract)
      } else {
        const contractSelect = document.querySelector('#id_clientecontrato')
        if (contractSelect && contractSelect.value === '') {
          const opts = Array.from(contractSelect.options).filter(function(o) {
            return o.value && !o.text.includes('CANCELADO')
          })
          if (opts.length === 1) setValue('#id_clientecontrato', opts[0].value)
        }
      }

      // Descrição e tipo
      if (data.osText) setValue('#id_conteudo', data.osText.toUpperCase())
      if (data.occurrenceType) setValue('#id_tipo', data.occurrenceType)

      // OS e status
      if (data.shouldCreateOS) {
        setCheck('#id_os', true)
      } else {
        setCheck('#id_os', false)
        if (data.occurrenceStatus === '1') setValue('#id_status', '1')
      }

      console.log('ATI: Formulário preenchido!')
    }

    function waitAndFill(attempts) {
      if (document.querySelector('#id_clientecontrato')) {
        fill()
      } else if (attempts < 30) {
        setTimeout(function() { waitAndFill(attempts + 1) }, 300)
      } else {
        console.error('ATI: Formulário não encontrado após 9s.')
      }
    }

    waitAndFill(0)
  })
})()