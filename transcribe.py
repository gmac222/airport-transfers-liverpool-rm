import speech_recognition as sr
r = sr.Recognizer()
with sr.AudioFile(r'C:\Users\graha\Downloads\whatsapp_audio.wav') as source:
    audio = r.record(source)
try:
    print(r.recognize_google(audio))
except sr.UnknownValueError:
    print('Google Speech Recognition could not understand audio')
except sr.RequestError as e:
    print('Could not request results from Google Speech Recognition service; {0}'.format(e))
