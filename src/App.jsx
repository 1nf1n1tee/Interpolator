import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import Papa from "papaparse";
import './App.css';

function App() {
  // ----- State -----
  const [nodes, setNodes] = useState([{ x: 0, y: 0 }, { x: 1, y: 1 }]); // Original nodes
  const [activeX, setActiveX] = useState(nodes.map(n => n.x));
  const [activeY, setActiveY] = useState(nodes.map(n => n.y));
  const [method, setMethod] = useState("lagrange");
  const [chebyshevEnabled, setChebyshevEnabled] = useState(false);
  const [chebInterval, setChebInterval] = useState({ a: 0, b: 1 });
  const [chebCount, setChebCount] = useState(nodes.length);
  const [evalX, setEvalX] = useState("");
  const [evalY, setEvalY] = useState(null);

  // Random Node Generator state
  const [randCount, setRandCount] = useState(5);
  const [randXMin, setRandXMin] = useState(0);
  const [randXMax, setRandXMax] = useState(1);
  const [randYMin, setRandYMin] = useState(0);
  const [randYMax, setRandYMax] = useState(1);



  // ----- Node Updates -----
  useEffect(() => {
    if (chebyshevEnabled) {
      const { a, b } = chebInterval;
      const n = chebCount;
      const xCheb = [];
      for (let k = 0; k < n; k++) {
        xCheb.push(
          (a + b)/2 + ((b - a)/2) * Math.cos(Math.PI * (2*k +1)/(2*n))
        );
      }
      setActiveX(xCheb);
      setActiveY(nodes.slice(0, n).map(n => n.y ?? 0));
    } else {
      setActiveX(nodes.map(n => n.x));
      setActiveY(nodes.map(n => n.y));
    }
  }, [chebyshevEnabled, chebInterval, chebCount, nodes]);

  // ----- Interpolation Algorithms -----
  const lagrangeEval = (x) => {
    let y = 0;
    for (let i = 0; i < activeX.length; i++) {
      let term = activeY[i];
      for (let j = 0; j < activeX.length; j++) {
        if (i !== j) term *= (x - activeX[j]) / (activeX[i] - activeX[j]);
      }
      y += term;
    }
    return y;
  };
  // Vandermonde interpolation using linear system
  const vandermondeEval = (x) => {
    const n = activeX.length;
    // Build Vandermonde matrix
    const A = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        row.push(Math.pow(activeX[i], j));
      }
      A.push(row);
    }

    // Solve for coefficients using Gaussian elimination
    const b = [...activeY];
    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      // Pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [b[i], b[maxRow]] = [b[maxRow], b[i]];

      // Eliminate
      for (let k = i + 1; k < n; k++) {
        const factor = A[k][i] / A[i][i];
        for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
        b[k] -= factor * b[i];
      }
    }

    // Back substitution
    const coef = Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let sum = 0;
      for (let j = i + 1; j < n; j++) sum += A[i][j] * coef[j];
      coef[i] = (b[i] - sum) / A[i][i];
    }

    // Evaluate polynomial at x
    let y = 0;
    for (let i = 0; i < n; i++) y += coef[i] * Math.pow(x, i);
    return y;
  };

  const newtonDividedDifference = () => {
    const n = activeX.length;
    const coef = [...activeY];
    for (let j = 1; j < n; j++) {
      for (let i = n-1; i >= j; i--) {
        coef[i] = (coef[i] - coef[i-1]) / (activeX[i] - activeX[i-j]);
      }
    }
    return coef;
  };

  const newtonEval = (x) => {
    const coef = newtonDividedDifference();
    let result = coef[coef.length-1];
    for (let i = coef.length-2; i >=0; i--) {
      result = result * (x - activeX[i]) + coef[i];
    }
    return result;
  };

  const interpolateY = (x) => {
    if (method === "vandermonde") return vandermondeEval(x);
    if (method === "lagrange") return lagrangeEval(x);
    return newtonEval(x); // default
  };

  // ----- Evaluation -----
  useEffect(() => {
    if (evalX === "") { setEvalY(null); return; }
    const xNum = parseFloat(evalX);
    if (!isNaN(xNum)) setEvalY(interpolateY(xNum));
    else setEvalY(null);
  }, [evalX, activeX, activeY, method]);

  // ----- CSV Import -----
  const handleCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      complete: function(results) {
        const data = results.data.filter(d => d.x != null && d.y != null);
        if (data.length < 2) { alert("Need at least 2 nodes"); return; }
        setNodes(data.map(d => ({x:d.x, y:d.y})));
      }
    });
  };

  // ----- Random Generation -----
  const generateRandomNodes = () => {
    const arr = [];
    for (let i = 0; i < randCount; i++) {
      arr.push({
        x: Math.random() * (randXMax - randXMin) + randXMin,
        y: Math.random() * (randYMax - randYMin) + randYMin
      });
    }
    arr.sort((a, b) => a.x - b.x);
    setNodes(arr);
  };


  // ----- Plot Data -----
  const xMin = Math.min(...activeX);
  const xMax = Math.max(...activeX);
  const plotX = Array.from({length: 200}, (_,i)=> xMin + i*(xMax-xMin)/199);
  const plotY = plotX.map(x=>interpolateY(x));

  return (
    <div className="app-container">
      <div className="sidebar">
        <h2>Node Input</h2>
        <button onClick={()=>setNodes([...nodes, {x:0, y:0}])}>Add Node</button>
        <table className="node-table">
          <thead>
            <tr><th>X</th><th>Y</th><th>Remove</th></tr>
          </thead>
          <tbody>
            {nodes.map((n,i)=>(
              <tr key={i}>
                <td><input type="number" value={n.x} onChange={e=> {
                  const val=parseFloat(e.target.value);
                  setNodes(nodes.map((old,j)=> j===i? {...old, x:val}: old));
                }}/></td>
                <td><input type="number" value={n.y} onChange={e=>{
                  const val=parseFloat(e.target.value);
                  setNodes(nodes.map((old,j)=> j===i? {...old, y:val}: old));
                }}/></td>
                <td><button onClick={()=>setNodes(nodes.filter((_,j)=>j!==i))}>X</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <h2>CSV Upload</h2>
        <input type="file" accept=".csv" onChange={handleCSV} />
        <h2>Random Nodes</h2>

        <label>Number of nodes:</label>
        <input type="number" value={randCount} min={2} onChange={e=>setRandCount(parseInt(e.target.value))} />

        <label>X range min:</label>
        <input type="number" value={randXMin} onChange={e=>setRandXMin(parseFloat(e.target.value))} />

        <label>X range max:</label>
        <input type="number" value={randXMax} onChange={e=>setRandXMax(parseFloat(e.target.value))} />

        <label>Y range min:</label>
        <input type="number" value={randYMin} onChange={e=>setRandYMin(parseFloat(e.target.value))} />

        <label>Y range max:</label>
        <input type="number" value={randYMax} onChange={e=>setRandYMax(parseFloat(e.target.value))} />

        <button onClick={generateRandomNodes}>Generate Nodes</button>


        <h2>Interpolation Method</h2>
        <select value={method} onChange={e => setMethod(e.target.value)}>
          <option value="vandermonde">Vandermonde</option>
          <option value="lagrange">Lagrange</option>
          <option value="newton">Newton</option>
        </select>


        <h2>Chebyshev Nodes</h2>
        <label>
          <input type="checkbox" checked={chebyshevEnabled} onChange={e=>setChebyshevEnabled(e.target.checked)}/> Enable
        </label>
        {chebyshevEnabled && <>
          <label>Interval a:</label>
          <input type="number" value={chebInterval.a} onChange={e=>setChebInterval({...chebInterval, a:parseFloat(e.target.value)})}/>
          <label>Interval b:</label>
          <input type="number" value={chebInterval.b} onChange={e=>setChebInterval({...chebInterval, b:parseFloat(e.target.value)})}/>
          <label>Node Count:</label>
          <input type="number" value={chebCount} onChange={e=>setChebCount(parseInt(e.target.value))}/>
        </>}

        <h2>Evaluate</h2>
        <input type="number" value={evalX} onChange={e=>setEvalX(e.target.value)} placeholder="Enter x"/>
        {evalY !== null && <p>y = {evalY}</p>}

      </div>
      <div className="main-content">
        <Plot
          data={[
            { x: activeX, y: activeY, mode: 'markers', type: 'scatter', name: 'Nodes', marker: {color:'red', size:8} },
            { x: plotX, y: plotY, mode: 'lines', type: 'scatter', name: 'Interpolation', line: {color:'blue'} }
          ]}
          layout={{width:800, height:600, title:'Interpolation', xaxis:{title:'X'}, yaxis:{title:'Y'}}}
        />
      </div>
    </div>
  );
}

export default App;
