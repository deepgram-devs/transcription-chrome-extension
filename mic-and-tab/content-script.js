let socket

chrome.storage.local.set({ transcript: '' })

let apiKey
chrome.storage.local.get('key', ({ key }) => apiKey = key)

navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }).then(async screenStream => {
    if(screenStream.getAudioTracks().length == 0) return alert('You must share your tab with audio. Refresh the page.')

    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true })

    const audioContext = new AudioContext()
    const mixed = mix(audioContext, [screenStream, micStream])
    const recorder = new MediaRecorder(mixed, { mimeType: 'audio/webm' })

    socket = new WebSocket('wss://api.deepgram.com/v1/listen?model=general-enhanced', ['token', apiKey])

    recorder.addEventListener('dataavailable', evt => {
        if(evt.data.size > 0 && socket.readyState == 1) socket.send(evt.data)
    })

    socket.onopen = () => { recorder.start(250) }

    socket.onmessage = msg => {
        const { transcript } = JSON.parse(msg.data).channel.alternatives[0]
        if(transcript) {
            console.log(transcript)
            chrome.storage.local.get('transcript', data => {
                chrome.storage.local.set({ transcript: data.transcript += ' ' + transcript })

                // Throws error when popup is closed, so this swallows the errors.
                chrome.runtime.sendMessage({ message: 'transcriptavailable' }).catch(err => ({}))
            })
        }
    }
})

chrome.runtime.onMessage.addListener(({ message }) => {
    if(message == 'stop') {
        socket.close()
        alert('Transcription ended')
    }
})

// https://stackoverflow.com/a/47071576
function mix(audioContext, streams) {
    const dest = audioContext.createMediaStreamDestination()
    streams.forEach(stream => {
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(dest);
    })
    return dest.stream
}
