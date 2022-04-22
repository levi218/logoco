// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styles from './app.module.css';
import NxWelcome from './nx-welcome';
import React, { useCallback, useEffect, useRef } from 'react';
import useState from 'react-usestateref';
// import '../turtle-world/demo';
import { Interpreter, List } from '../turtle-world/logo';
import { TurtleGraphics } from '../turtle-world/turtle';
import Editor from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';
// import io, { Socket } from 'socket.io-client';
import * as Automerge from 'automerge';

// Create your own language definition here
// You can safely look at other samples without losing modifications.
// Modifications are not saved on browser refresh/close though -- copy often!
loader.init().then((monaco) => {
  console.log('here is the monaco instance:', monaco);
  // Create your own language definition here
  // You can safely look at other samples without losing modifications.
  // Modifications are not saved on browser refresh/close though -- copy often!
  const logoLanguageDefinition = {
    // Set defaultToken to invalid to see what you do not tokenize yet
    // defaultToken: 'invalid',

    keywords: [
      'cs',
      'up',
      'seth',
      'back',
      'right',
      'down',
      'repeat',
      'forward',
      'print',
      'color',
    ],

    typeKeywords: [
      '"black',
      '"blue',
      '"green',
      '"red',
      '"cyan',
      '"magenta',
      '"yellow',
      '"white',
      '"brown',
      '"tan',
      '"forest',
      '"aqua',
      '"salmon',
      '"purple',
      '"orange',
      '"grey',
    ],

    // The main tokenizer for our languages
    tokenizer: {
      root: [
        // identifiers and keywords
        [
          /["a-z_$][\w$]*/,
          {
            cases: {
              '@typeKeywords': 'type.identifier',
              '@keywords': 'keyword',
              // '@default': 'identifier'
            },
          },
        ],
        [/(^;.*$)/, 'comment'],
      ],
    },
  };

  // Register a new language
  monaco.languages.register({ id: 'logoLanguage' });

  // Register a tokens provider for the language
  monaco.languages.setMonarchTokensProvider(
    'logoLanguage',
    logoLanguageDefinition as any
  );

  const loggerDefinition = {
    // Set defaultToken to invalid to see what you do not tokenize yet
    // The main tokenizer for our languages
    tokenizer: {
      root: [
        // identifiers and keywords
        [/\[[a-zA-Z 0-9:]+\]/, 'comment'],
      ],
    },
  };

  // Register a new language
  monaco.languages.register({ id: 'loggerDefinition' });

  // Register a tokens provider for the language
  monaco.languages.setMonarchTokensProvider(
    'loggerDefinition',
    loggerDefinition as any
  );
});

interface EditorState {
  content: Automerge.Text;
}

export function App() {
  const displayRef = useRef<any>();
  const logBoxRef = useRef<any>();
  const editorRef = useRef<any>();
  const editorOnChangeTimeoutRef = useRef<any>();
  const isLoading = useRef(true);
  const [isEditorReady, setIsEditorReady] = useState(false);
  // const [socket, setSocket] = useState<Socket>();
  const [autoMergeState, setAutoMergeState, autoMergeStateRef] =
    useState<any>();
  // useEffect(() => {
  //   if (!socket && isEditorReady) {
  //     console.log('useEffect trigegered');
  //     const socket = io('http://localhost:3333', {
  //       transports: ['websocket'],
  //       query: { roomName: 'n' },
  //     });
  //     socket.on('connect', () => {
  //       console.log('connected');
  //     });
  //     socket.on('init_document', (byteState) => {
  //       console.log('init_document', byteState);
  //       const state = Automerge.load<EditorState>(
  //         new Uint8Array(byteState) as Automerge.BinaryDocument
  //       );
  //       setAutoMergeState(state);
  //       setCode(state.content.toString());
  //       console.log('upstream:', JSON.stringify(state.content.toString()));
  //       isLoading.current = false;
  //     });
  //     socket.on('update_document', (changes) => {
  //       console.log('update_document', changes, autoMergeStateRef.current);
  //       const [newState, _] = Automerge.applyChanges<EditorState>(
  //         autoMergeStateRef.current,
  //         changes.map((e: any) => new Uint8Array(e))
  //       );
  //       console.log('conflicts', Automerge.getConflicts(newState, 'content'));
  //       setAutoMergeState(newState);
  //       setCode(newState.content.toString());
  //     });

  //     setSocket(socket);
  //   }
  // }, [isEditorReady]);
  const onRefChange = useCallback((node: any) => {
    if (node === null) {
      // DOM node referenced by ref has been unmounted
    } else {
      // DOM node referenced by ref has changed and exists
      displayRef.current = node;
      const turtle = new TurtleGraphics(node, 640, 480);
      setTurtle(turtle);
      const api = {
        // Turtle commands
        cs: async function () {
          turtle.clearScreen();
        },
        xcor: async function () {
          return turtle.x;
        },
        ycor: async function () {
          return turtle.y;
        },
        pos: async function () {
          return List.of(turtle.x, turtle.y);
        },
        setpos: async function (list: any) {
          if (!(list instanceof List)) {
            throw new TypeError('list must be a list');
          }
          if (list.isEmpty() || list.tail.isEmpty()) {
            throw new TypeError('list must have two elements');
          }
          const x = Number(list.head);
          const y = Number(list.tail.head);
          turtle.setPos(x, y);
        },
        heading: async function () {
          return turtle.heading;
        },
        seth: async function (val: any) {
          turtle.heading = Number(val);
        },
        forward: async function (dist: any) {
          turtle.forward(+dist);
        },
        back: async function (dist: any) {
          turtle.back(+dist);
        },
        right: async function (deg: any) {
          turtle.right(+deg);
        },
        left: async function (deg: any) {
          turtle.left(+deg);
        },
        up: async function () {
          turtle.up();
        },
        down: async function () {
          turtle.down();
        },
        color: async function (color: any) {
          turtle.setColor('' + color);
        },
      };

      logo.procedureScope.bindValues(api);
      logo.onprint = async function (str: any) {
        console.log('output', str);
        const data = logBoxRef.current?.getValue();
        console.log('output2', data, logBoxRef.current);
        logBoxRef.current?.setValue(
          `${data}\n[${new Date().toLocaleTimeString()}] ${str}`
        );
        logBoxRef.current?.revealLine(
          logBoxRef.current?.getModel().getLineCount()
        );
      };
    }
  }, []); // adjust deps
  const [turtle, setTurtle] = useState<any>();
  const [logo, setLogo] = useState(new Interpreter());
  const [code, setCode, codeRef] = useState(
    `
  ; Reset screen if you run it again
  cs up seth 0 setpos [0 0]

  up back 100 right 10 down
  make "n 1
  color "green
  repeat 18 [
      forward 200 right 10 back 200 right 10
  ]

  print "Done!

  `
  );
  // const [logs, setLogs, logsRef] = useState(``);

  const onChange = (newValue: any, event: any) => {
    setCode(newValue);
    // if (isLoading.current) return;
    // if (editorOnChangeTimeoutRef.current) {
    //   clearTimeout(editorOnChangeTimeoutRef.current);
    // }
    // editorOnChangeTimeoutRef.current = setTimeout(() => {
    //   console.log('onChange', JSON.stringify(newValue), JSON.stringify(event));
    //   const changes = event.changes.map((e: any) => ({
    //     offset: e.rangeOffset,
    //     text: e.text,
    //   }));
    //   socket?.emit('update_document', changes);
    //   editorOnChangeTimeoutRef.current = undefined;
    // }, 2000);
    // logo.execute(code);
  };
  function handleLogboxDidMount(editor: any, monaco: any) {
    // here is the editor instance
    // you can store it in `useRef` for further usage
    logBoxRef.current = editor;
  }

  function handleEditorDidMount(editor: any, monaco: any) {
    editorRef.current = editor;
    setIsEditorReady(true);
  }
  return (
    <div style={{ flex: 1, flexDirection: 'row', display: 'flex' }}>
      {/* <NxWelcome title="client" /> */}
      {/* <div /> */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div id="logo-display" ref={onRefChange} style={{ flex: 2 }}></div>
        <div id="logger" style={{ flex: 1, display: 'flex' }}>
          <Editor
            onMount={handleLogboxDidMount}
            defaultLanguage="loggerDefinition"
            width="100%"
            height="100%"
            // defaultValue={code}
            options={{
              readOnly: true,
              lineNumbers: 'off',
              // glyphMargin: false,
              // folding: false,
              minimap: {
                enabled: false,
              },
              renderLineHighlight: 'none',
            }}
          />
        </div>
      </div>
      {/* <div id="logo-debug"></div>
      <div id="logo-console"></div>
      <button id="logo-run">Execute</button>
      <button id="logo-pause" disabled>
        Pause
      </button>
      <button id="logo-break" disabled>
        Break
      </button> */}
      {/* <textarea id="logo-input">
        ; Reset screen if you run it again cs up seth 0 setpos [0 0] up back 100
        right 10 down make "n 1 repeat 18 [ color item :n [black blue green red]
        make "n 1 + remainder :n 4 forward 200 right 10 back 200 right 10 ]
        print "Done!
      </textarea> */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1 }}>
          <Editor
            defaultLanguage="logoLanguage"
            onMount={handleEditorDidMount}
            width="100%"
            height="100%"
            theme="vs-dark"
            value={code}
            options={{
              selectOnLineNumbers: true,
            }}
            onChange={onChange}
          />
        </div>
        <button
          onClick={() => {
            // setCode('aaa');
            console.log(code);
            logo.execute(codeRef.current);
          }}
        >
          go
        </button>
      </div>
    </div>
  );
}

export default App;
