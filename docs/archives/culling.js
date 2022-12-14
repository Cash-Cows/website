window.addEventListener('web3sdk-ready', async () => {
  //------------------------------------------------------------------//
  // Variables
  const response = await fetch('/data/metadata.json')
  const database = await response.json()
  const occurances = {}

  const results = document.querySelector('main.results')
  const milkValue = document.querySelector('span.milk span.value')
  const steakValue = document.querySelector('span.steak span.value')

  const template = {
    item: document.getElementById('template-result-item').innerHTML,
    modal: document.getElementById('template-modal').innerHTML
  }

  const network = Web3SDK.network('ethereum')
  const nft = network.contract('nft')
  const index = network.contract('index')
  const milk = network.contract('milk')
  const culling = network.contract('culling')
  const metadata = network.contract('metadata')

  const messages = [
    'I thought you loved moo.',
    'Moo! Don\'t do it!',
    'Do you want Sacowfice me?',
    'I thought we had something together.',
    'I thought we would grow old together.',
    'Bitch Im a cow. Moo0ooOoove!',
    'Moo. Get rich or die trying...',
    'Buh Bye.',
    'Let\'s get rich together?',
    'Moo. I dare you.',
    'Moo! Do not press that button.',
    'Why me?!?',
    'My milkshake brings all the ETH to the barn.',
    'I have special perks in the end.',
    'What did I do wrong?',
    'I\'m heart broken.',
    'No. Your not worthy.',
    'What did I do to you?',
    'You will not receive 1 steak.',
    'Burn me later for 2 steaks...'
  ]

  //------------------------------------------------------------------//
  // Functions

  const connected = async state => {
    steakValue.innerHTML = parseFloat(
      await culling.read().balanceOf(state.account)
    ).toFixed(0)
    milkValue.innerHTML = Web3SDK.toEther(
      await milk.read().balanceOf(state.account), 'number'
    ).toFixed(6)
    //populate cows
    Web3SDK.state.tokens = await index.read().ownerTokens(
      nft.address, 
      state.account,
      4030
    )
 
    if (!Web3SDK.state.tokens.length) {
      results.innerHTML = '<div class="alert alert-error alert-outline">You don\'t have a cow.</div>'
    }

    Web3SDK.state.tokens.forEach(async (tokenId, i) => {
      const stage = parseInt(await metadata.read().stage(tokenId))
      const row = database.rows.filter(row => row.edition == tokenId)[0]
      let badge = 'muted'
      if (row.rank < 100) {
        badge = 'success'
      } else if (row.rank < 500) {
        badge = 'warning'
      } else if (row.rank < 1000) {
        badge = 'info'
      }
      const item = theme.toElement(template.item, {
        '{INDEX}': row.index,
        '{NAME}': `#${tokenId}`,
        '{RANK}': row.rank,
        '{BADGE}': badge,
        '{SCORE}': row.score,
        '{ID}': tokenId,
        '{LEVEL}': stage + 1,
        '{IMAGE}': `/images/collection/${tokenId}_${stage}.png`,
        '{CHECKVALUE}': tokenId,
        '{ISCHECKED}': i < 10 ? 'checked': ''
      })

      results.appendChild(item)
      window.doon(item)
    })
  }

  const rarity = function() {
    //remove burned
    database.rows = database.rows.filter(row => row.attributes.Level > 0)
    //add indexes
    database.rows.forEach((row, i) => (row.index = i))
    //count occurances
    database.rows.forEach(row => {
      Object.keys(row.attributes).forEach(trait => {
        const value = String(row.attributes[trait])
        if (!occurances[trait]) occurances[trait] = {}
        if (!occurances[trait][value]) occurances[trait][value] = 0
        if (row.attributes.Level > 0) occurances[trait][value]++
        //reformat
        row.attributes[trait] = { value }
      })
    })
    //add occurance and score to each
    database.rows.forEach(row => {
      row.score = 0
      Object.keys(row.attributes).forEach(trait => {
        const value = row.attributes[trait].value
        const occurance = occurances[trait][value]
        row.attributes[trait].occurances = occurance
        row.attributes[trait].score = 1 / (occurance / database.rows.length)
        row.score += row.attributes[trait].score
      })

      row.score += row.attributes.Level.value * 1000
    })
    //now we need to determine each rank
    let rank = 1
    const ranked = database.rows.slice().sort((a, b) => b.score - a.score)
    ranked.forEach((row, i) => {
      row.rank = i == 0 
        || Math.floor(ranked[i - 1].score * 100) == Math.floor(row.score * 100) 
        ? rank
        : ++rank
    })
  }

  const disconnected = async _ => {
    delete Web3SDK.state.tokens
    results.innerHTML = ''
  }

  //------------------------------------------------------------------//
  // Events

  window.addEventListener('modal-open-click', async (e) => {
    const id = parseInt(e.for.getAttribute('data-id'))
    const row = database.rows.filter(row => row.edition == id)[0]
    const level = parseInt(e.for.getAttribute('data-level'))

    const modal = theme.toElement(template.modal, {
      '{ID}': id,
      '{MESSAGE}': messages[row.edition % messages.length] || messages[0],
      '{COLOR}': row.attributes.Background.value.toLowerCase(),
      '{IMAGE}': `/images/collection/${id}_${level - 1}.png`
    })
    document.body.appendChild(modal)
    window.doon(modal)
  })

  window.addEventListener('modal-close-click', () => {
    document.body.removeChild(document.querySelector('div.modal'))
  })

  window.addEventListener('burn-click', async (e) => {
    const tokenId = parseInt(e.for.getAttribute('data-id'))
    //gas check
    try {
      await culling.gas(Web3SDK.state.account, 0).burn(tokenId)
    } catch(e) {
      const pattern = /have (\d+) want (\d+)/
      const matches = e.message.match(pattern)
      if (matches && matches.length === 3) {
        e.message = e.message.replace(pattern, `have ${
          Web3SDK.toEther(matches[1], 'int').toFixed(5)
        } ETH want ${
          Web3SDK.toEther(matches[2], 'int').toFixed(5)
        } ETH`)
      }
      notify('error', e.message.replace('err: i', 'I'))
      console.error(e)
      return
    }
    //now burn
    try {
      await culling.write(Web3SDK.state.account, 0, 2).burn(tokenId)
      e.for.parentNode.removeChild(e.for)
      document.body.removeChild(document.querySelector('div.modal'))
      steakValue.innerHTML = parseFloat(
        await culling.read().balanceOf(Web3SDK.state.account)
      ).toFixed(0)
      milkValue.innerHTML = Web3SDK.toEther(
        await milk.read().balanceOf(Web3SDK.state.account), 'number'
      ).toFixed(6)
    } catch(e) {
      notify('error', e.message.replace('err: i', 'I'))
      console.error(e)
      return
    }
  })

  window.addEventListener('watch-click', async(e) => {
    await milk.addToWallet()
  })

  //------------------------------------------------------------------//
  // Initialize

  //count occurances
  rarity()

  //start session
  network.startSession(connected, disconnected, true)
})
