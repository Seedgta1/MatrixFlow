import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MatrixNode, AvatarConfig } from '../types';
import { User, Zap, Flame, Calendar, Users, X, Activity, ChevronDown, Search, Hash, ShieldCheck, Link as LinkIcon } from 'lucide-react';

interface TreeProps {
  data: MatrixNode;
}

const TreeVisualizer: React.FC<TreeProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const rootRef = useRef<d3.HierarchyPointNode<MatrixNode> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const gRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<MatrixNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data: MatrixNode | null;
  }>({ visible: false, x: 0, y: 0, data: null });

  // Hexagon Path Generator
  const hexPath = (r: number) => {
    // Pointy topped hexagon
    const points = [];
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 90) * (Math.PI / 180); // -90 starts at 12 o'clock
        points.push([r * Math.cos(angle), r * Math.sin(angle)]);
    }
    return "M" + points.map(p => p.join(",")).join("L") + "Z";
  };

  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.offsetWidth,
          height: Math.max(500, wrapperRef.current.offsetHeight)
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 

    const { width, height } = dimensions;
    const margin = { top: 80, right: 20, bottom: 40, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Define clip path for Hexagonal avatars
    const defs = svg.append("defs");
    defs.append("clipPath")
        .attr("id", "avatar-hex-clip")
        .append("path")
        .attr("d", hexPath(20)); // Match avatar size

    const root = d3.hierarchy<MatrixNode>(data);
    const treeLayout = d3.tree<MatrixNode>().size([innerWidth, innerHeight - 100]);
    const processedRoot = treeLayout(root);
    rootRef.current = processedRoot;

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        if (gRef.current) {
            gRef.current.attr('transform', event.transform);
        }
      });
    
    zoomRef.current = zoom;
    svg.call(zoom);

    // Initial positioning: Center the root node
    const initialTransform = d3.zoomIdentity
        .translate(width / 2, margin.top)
        .scale(1)
        .translate(-processedRoot.x, -processedRoot.y);
    
    svg.call(zoom.transform, initialTransform);


    const g = svg.append('g');
    gRef.current = g;

    // Links (Curved lines)
    g.selectAll('.link')
      .data(processedRoot.links())
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', '#6366f1')
      .attr('stroke-opacity', 0.3)
      .attr('stroke-width', 1.5)
      .attr('d', d3.linkVertical()
        .x((d: any) => d.x)
        .y((d: any) => d.y) as any
      )
      // Animation for links
      .attr("stroke-dasharray", function() { return (this as SVGPathElement).getTotalLength() })
      .attr("stroke-dashoffset", function() { return (this as SVGPathElement).getTotalLength() })
      .transition()
      .duration(1000)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);


    // Nodes Group
    const nodes = g.selectAll('.node')
      .data(processedRoot.descendants())
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d.data);
      })
      .on('touchstart', (event, d) => {
        // Handle touch tap
         event.stopPropagation();
         setSelectedNode(d.data);
      })
      .on('mouseover', function(event, d) {
        // Enlarge effect on group contents, not the group itself to avoid jitter
        d3.select(this).select('.node-visuals')
          .transition().duration(200)
          .attr('transform', 'scale(1.15)');
        
        // Pulse effect on outer ring
        d3.select(this).select('.status-hex')
          .classed('animate-pulse-ring', true);

        // Enlarge Badge
        d3.select(this).select('.badge-group')
          .transition().duration(200)
          .attr('transform', 'translate(18, -18) scale(1.4)'); // Adjusted for hex corner

        const containerRect = wrapperRef.current?.getBoundingClientRect();
        if (containerRect) {
            setTooltip({
                visible: true,
                x: event.clientX - containerRect.left,
                y: event.clientY - containerRect.top,
                data: d.data
            });
        }
      })
      .on('mousemove', function(event) {
        const containerRect = wrapperRef.current?.getBoundingClientRect();
        if (containerRect) {
            setTooltip(prev => ({
                ...prev,
                x: event.clientX - containerRect.left,
                y: event.clientY - containerRect.top
            }));
        }
      })
      .on('mouseout', function(event, d) {
        // Reset scale
        d3.select(this).select('.node-visuals')
            .transition().duration(200)
            .attr('transform', 'scale(1)');
        
        // Remove Pulse
        d3.select(this).select('.status-hex')
            .classed('animate-pulse-ring', false);

        // Reset Badge
        d3.select(this).select('.badge-group')
            .transition().duration(200)
            .attr('transform', 'translate(18, -18) scale(1)');

        setTooltip(prev => ({ ...prev, visible: false }));
      });

    // --- NODE VISUALS CONTAINER ---
    const visuals = nodes.append('g').attr('class', 'node-visuals');

    // 1. Rotating Outer Dashed Hexagon (Logo Style)
    visuals.append('g')
        .attr('class', 'animate-spin-slow origin-center') 
        .append('path')
        .attr('d', hexPath(26))
        .attr('fill', 'none')
        .attr('stroke', '#6366f1')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4 2')
        .attr('stroke-opacity', 0.5);

    // 2. Status Hexagon (Solid)
    visuals.append('path')
      .attr('d', hexPath(23))
      .attr('fill', 'none')
      .attr('stroke', (d) => d.data.children.length === 10 ? '#ef4444' : '#10b981') // Red if 10 (Full), Green if < 10
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.8)
      .attr('class', 'status-hex');

    // 3. Avatar Background Hexagon
    visuals.append('path')
      .attr('d', hexPath(20))
      .attr('fill', '#1e293b');

    // 4. Avatar Image - Clipped by Hexagon
    visuals.append('image')
      .attr('xlink:href', (d) => {
         const config = d.data.avatarConfig || { style: 'bottts-neutral', seed: d.data.username, backgroundColor: 'transparent' };
         return `https://api.dicebear.com/9.x/${config.style}/svg?seed=${config.seed}&backgroundColor=${config.backgroundColor}`;
      })
      .attr('width', 40)
      .attr('height', 40)
      .attr('x', -20)
      .attr('y', -20)
      .attr('clip-path', 'url(#avatar-hex-clip)')
      .style('pointer-events', 'none'); 

    // 5. Selection Hexagon (Gold Glow)
    nodes.filter(d => !!(selectedNode && d.data.id === selectedNode.id))
      .select('.node-visuals')
      .append('path')
      .attr('d', hexPath(30))
      .attr('fill', 'none')
      .attr('stroke', '#f59e0b')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '6 3')
      .attr('class', 'selection-hex animate-[spin_4s_linear_infinite]'); // Faster spin for selection

    // 6. Entrance Animation (Pop in)
    nodes.attr('opacity', 0)
      .transition()
      .duration(600)
      .delay((d) => d.depth * 150) 
      .ease(d3.easeBackOut)
      .attr('opacity', 1);

    // Node Labels (Username)
    nodes.append('text')
      .attr('dy', 45) // Pushed down slightly due to larger hex visual
      .attr('x', 0)
      .style('text-anchor', 'middle')
      .style('font-size', '10px')
      .style('font-weight', '700')
      .style('fill', '#cbd5e1')
      .style('text-shadow', '0 2px 4px rgba(0,0,0,0.9)')
      .text((d) => d.data.username);

    // Badge: Personal Utilities Count (Top-Right of Hex)
    // Hex corner is roughly at (r*cos(30), -r*sin(30)) -> (17, -10) for r=20.
    // We want it slightly outside.
    const badge = nodes.append('g')
        .attr('class', 'badge-group')
        .attr('transform', 'translate(18, -18)');

    badge.append('circle')
        .attr('r', 9)
        .attr('fill', '#3b82f6')
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 2);

    badge.append('text')
        .attr('dy', 3)
        .style('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .style('fill', '#fff')
        .text((d) => d.data.utilities?.length || 0);

  }, [data, dimensions, selectedNode]);

  // Utility logic helper
  const getUtilityCounts = (node: MatrixNode) => {
    const luce = node.utilities?.filter(u => u.type === 'Luce').length || 0;
    const gas = node.utilities?.filter(u => u.type === 'Gas').length || 0;
    return { luce, gas };
  };

  const getAvatarUrl = (node: MatrixNode) => {
    const config = node.avatarConfig || { style: 'bottts-neutral', seed: node.username, backgroundColor: 'transparent' };
    return `https://api.dicebear.com/9.x/${config.style}/svg?seed=${config.seed}&backgroundColor=${config.backgroundColor}`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !rootRef.current || !svgRef.current || !zoomRef.current) return;

    const query = searchQuery.toLowerCase();
    const foundNode = rootRef.current.descendants().find(
      d => d.data.username.toLowerCase() === query || d.data.id.toLowerCase() === query
    );

    if (foundNode) {
      setSearchError(false);
      setSelectedNode(foundNode.data);

      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;
      const targetX = foundNode.x;
      const targetY = foundNode.y;
      const scale = 1.5; 

      const transform = d3.zoomIdentity
        .translate(cx - targetX * scale, cy - targetY * scale) 
        .scale(scale);

      d3.select(svgRef.current)
        .transition()
        .duration(1200)
        .ease(d3.easeCubicInOut)
        .call(zoomRef.current.transform, transform);
      
      // Collapse search on mobile after find
      if (window.innerWidth < 768) {
          setIsSearchExpanded(false);
      }
        
    } else {
      setSearchError(true);
      setTimeout(() => setSearchError(false), 2000);
    }
  };

  return (
    <div ref={wrapperRef} className="w-full h-full bg-[#0B1120] rounded-xl border border-white/5 shadow-2xl relative overflow-hidden group animate-enter">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '20px 20px' }}>
      </div>

      {/* Search Bar - Responsive */}
      <div className={`absolute top-2 right-2 md:top-4 md:right-4 z-20 flex justify-end transition-all duration-300 ${isSearchExpanded ? 'w-full pr-4' : 'w-auto'}`}>
         {/* Mobile Trigger */}
         <button 
            className={`md:hidden p-2.5 rounded-full glass-panel text-slate-300 hover:text-white transition-all ${isSearchExpanded ? 'hidden' : 'block'}`}
            onClick={() => setIsSearchExpanded(true)}
         >
             <Search className="w-5 h-5" />
         </button>

         <form onSubmit={handleSearch} className={`flex items-center transition-all duration-300 ${isSearchExpanded ? 'w-full opacity-100' : 'w-0 opacity-0 md:w-auto md:opacity-100 overflow-hidden'}`}>
            <div className={`flex items-center glass-panel rounded-full transition-all duration-300 w-full ${searchError ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'hover:border-indigo-500/50 hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]'}`}>
                <input 
                  type="text" 
                  placeholder="Cerca username..." 
                  className="bg-transparent border-none text-white text-base md:text-sm px-4 py-2 w-full md:w-48 focus:outline-none placeholder-slate-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus={isSearchExpanded}
                  onBlur={() => { if(!searchQuery) setIsSearchExpanded(false) }}
                />
                <button type="submit" className="p-2 text-slate-400 hover:text-white transition-colors">
                  <Search className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                {isSearchExpanded && (
                    <button type="button" onMouseDown={() => setIsSearchExpanded(false)} className="p-2 text-slate-400">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
         </form>
      </div>

      {/* Legend - Responsive */}
      <div className="absolute top-2 left-2 md:top-4 md:left-4 z-10 flex flex-col gap-1.5 md:gap-2 glass-panel p-1.5 md:p-3 rounded-lg pointer-events-none transition-all">
        <div className="hidden md:block text-[10px] uppercase text-slate-500 font-bold tracking-widest mb-1">Status Nodi</div>
        <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-300">
          <div className="w-3 h-3 flex items-center justify-center">
             <svg viewBox="0 0 20 20" className="w-full h-full overflow-visible">
               <path d="M10 1 L18 5.5 V14.5 L10 19 L2 14.5 V5.5 Z" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="2" className="shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
             </svg>
          </div>
          <span className="hidden md:inline">Aperto (&lt;10)</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-300">
          <div className="w-3 h-3 flex items-center justify-center">
             <svg viewBox="0 0 20 20" className="w-full h-full overflow-visible">
               <path d="M10 1 L18 5.5 V14.5 L10 19 L2 14.5 V5.5 Z" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="2" className="shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
             </svg>
          </div>
          <span className="hidden md:inline">Completo (10)</span>
        </div>
      </div>

      <svg 
        ref={svgRef} 
        width={dimensions.width} 
        height={dimensions.height} 
        className="w-full h-full cursor-move touch-none" 
        onClick={() => setSelectedNode(null)}
        style={{ touchAction: 'none' }} 
      />

      {/* Hover Tooltip - Quick stats only (Desktop) */}
      {tooltip.visible && tooltip.data && !selectedNode && (
        <div 
            className="absolute z-50 glass-card p-2.5 rounded-xl pointer-events-none transition-all duration-200 hidden md:block"
            style={{
                left: tooltip.x + 20,
                top: tooltip.y - 20,
                minWidth: '150px',
                transform: `scale(${tooltip.visible ? 1 : 0.9})`,
                opacity: tooltip.visible ? 1 : 0
            }}
        >
            <div className="flex items-center gap-2 mb-2">
                <img src={getAvatarUrl(tooltip.data)} alt="av" className="w-6 h-6 rounded-full" />
                <span className="text-white font-bold text-xs">{tooltip.data.username}</span>
            </div>
            <div className="text-[10px] text-slate-400">Clicca per i dettagli completi</div>
        </div>
      )}

      {/* Detail SIDE PANEL (Desktop) & BOTTOM SHEET (Mobile) */}
      {selectedNode && (
        <>
          {/* Mobile Overlay */}
          <div 
             className="md:hidden fixed inset-0 bg-black/60 z-20 backdrop-blur-sm transition-opacity"
             onClick={() => setSelectedNode(null)}
          ></div>
          
          <div 
            key={selectedNode.id}
            className={`
              fixed bottom-0 left-0 right-0 w-full rounded-t-2xl z-30 overflow-hidden border-t border-white/10 safe-area-bottom animate-enter
              md:absolute md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-80 md:h-full md:rounded-none md:border-t-0 md:border-l md:animate-slide-in-right
              glass-card shadow-2xl flex flex-col
            `}
          >
            {/* Header with Avatar */}
            <div className="relative h-24 bg-gradient-to-br from-indigo-900/60 to-purple-900/60 flex items-center justify-center">
                <button 
                  onClick={() => setSelectedNode(null)} 
                  className="absolute top-3 right-3 text-white/50 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                >
                    <X className="w-5 h-5" />
                </button>
                
                <div className="absolute -bottom-8 border-4 border-[#0B1120] rounded-full bg-[#0B1120]">
                   <img 
                      src={getAvatarUrl(selectedNode)}
                      alt="avatar"
                      className="w-16 h-16 rounded-full"
                   />
                </div>
            </div>

            <div className="pt-10 px-5 pb-5 flex-1 overflow-y-auto custom-scrollbar">
               <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white">{selectedNode.username}</h3>
                  <div className="text-xs text-indigo-300 font-mono mt-1">{selectedNode.email}</div>
               </div>

               {/* Key Info Grid */}
               <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                        <Hash className="w-3 h-3" /> ID Utente
                      </div>
                      <div className="text-xs text-white font-mono break-all">{selectedNode.id.split('-')[1]}</div>
                  </div>
                   <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Livello
                      </div>
                      <div className="text-xs text-emerald-400 font-bold">Livello {selectedNode.level}</div>
                  </div>
                  <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Iscrizione
                      </div>
                      <div className="text-xs text-white">{new Date(selectedNode.joinedAt).toLocaleDateString()}</div>
                  </div>
                  <div className="bg-slate-900/40 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1">
                        <LinkIcon className="w-3 h-3" /> Sponsor
                      </div>
                      <div className="text-xs text-indigo-300 font-bold truncate">{selectedNode.sponsorUsername || 'N/A'}</div>
                  </div>
               </div>

               <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 pl-1">Statistiche Rete</h4>
               <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="bg-gradient-to-br from-blue-900/20 to-blue-800/10 p-3 rounded-xl border border-blue-500/20 flex flex-col items-center justify-center gap-1">
                     <Users className="w-5 h-5 text-blue-500 mb-1" />
                     <div className="text-xl font-bold text-white">{selectedNode.totalDownline}</div>
                     <div className="text-[9px] text-blue-300 uppercase tracking-wider">Downline</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/10 p-3 rounded-xl border border-purple-500/20 flex flex-col items-center justify-center gap-1">
                     <Activity className="w-5 h-5 text-purple-500 mb-1" />
                     <div className="text-xl font-bold text-white">{selectedNode.totalUtilities}</div>
                     <div className="text-[9px] text-purple-300 uppercase tracking-wider">Volumi</div>
                  </div>
               </div>

               {/* Personal Utilities */}
               <div className="bg-slate-900/40 rounded-xl p-4 border border-white/5 mb-4">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Performance Personale</h4>
                  
                  <div className="space-y-3">
                      {/* Luce Bar */}
                      <div>
                          <div className="flex justify-between items-end mb-1">
                             <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                <Zap className="w-3.5 h-3.5 text-yellow-400" /> Luce
                             </div>
                             <span className="text-sm font-bold text-white">{getUtilityCounts(selectedNode).luce}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-400 rounded-full shadow-[0_0_10px_rgba(250,204,21,0.5)]" style={{width: `${(getUtilityCounts(selectedNode).luce / Math.max(1, (selectedNode.utilities?.length || 1))) * 100}%`}}></div>
                          </div>
                      </div>

                      {/* Gas Bar */}
                      <div>
                          <div className="flex justify-between items-end mb-1">
                             <div className="flex items-center gap-1.5 text-xs text-slate-300">
                                <Flame className="w-3.5 h-3.5 text-blue-400" /> Gas
                             </div>
                             <span className="text-sm font-bold text-white">{getUtilityCounts(selectedNode).gas}</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-700 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full shadow-[0_0_10px_rgba(96,165,250,0.5)]" style={{width: `${(getUtilityCounts(selectedNode).gas / Math.max(1, (selectedNode.utilities?.length || 1))) * 100}%`}}></div>
                          </div>
                      </div>
                  </div>
               </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TreeVisualizer;