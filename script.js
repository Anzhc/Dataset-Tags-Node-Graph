let linksArray = [];
let fixedNode = null;

function updateLinkVisibility(percentage) {
    // Convert the percentage to a decimal
    const displayPercentage = percentage / 100;

    // Find the maximum count for the links
    const maxCount = Math.max(...linksArray.map(link => link.count));
    // Calculate the count threshold for the given percentage
    // When the slider is at 0%, we set the threshold above the max count to hide all links
    // When the slider is at 100%, we set the threshold at 0 to show all links
    const countThreshold = displayPercentage === 0 ? maxCount + 1 : maxCount * (1 - displayPercentage);

    // Update the visibility of links based on whether their count meets or exceeds the count threshold
    d3.selectAll('.links line')
        .style('visibility', d => d.count >= countThreshold ? 'visible' : 'hidden');
}

// Listen to the slider's input event to update link visibility in real-time
document.getElementById('link-filter').addEventListener('input', function() {
    const percentage = this.value;
    document.getElementById('percentage').textContent = percentage + '%';
    updateLinkVisibility(percentage);
});

// Initialize the visualization with the current slider value
updateLinkVisibility(document.getElementById('link-filter').value);

document.getElementById('load-files').addEventListener('click', function() {
    let files = document.getElementById('file-input').files;
    let tagData = { nodes: {}, links: {} };
  
    // Filter out files that are not .txt before processing
    const textFiles = Array.from(files).filter(file => file.name.endsWith('.txt'));
  
    if (textFiles.length === 0) {
      console.error("No .txt files found in the selection.");
      return; // Exit if there are no text files
    }
  
    let filesProcessed = 0;
  
    // Process each text file
    textFiles.forEach(file => {
        let reader = new FileReader();
  
        reader.onload = function(e) {
            // Split the file content by commas and process each tag
            const tags = e.target.result.split(',').map(tag => tag.trim());
            
            // Iterate through the tags to populate the tagData.nodes
            tags.forEach(tag => {
              if (tagData.nodes[tag]) {
                tagData.nodes[tag].count += 1; // Increment count if tag already exists
              } else {
                tagData.nodes[tag] = { id: tag, count: 1 }; // Add new node for new tag
              }
            });
          
            // Create links by pairing tags within the same file
            for (let i = 0; i < tags.length; i++) {
              for (let j = i + 1; j < tags.length; j++) {
                let source = tags[i];
                let target = tags[j];
                let linkKey = source < target ? `${source}-${target}` : `${target}-${source}`;
                
                if (tagData.links[linkKey]) {
                  tagData.links[linkKey].count += 1; // Increment count if link already exists
                } else {
                  tagData.links[linkKey] = { source, target, count: 1 }; // Add new link for new tag pair
                }
              }
            }
          
            filesProcessed++;
            if (filesProcessed === textFiles.length) {
              createGraph(tagData);
              updateLinkVisibility(document.getElementById('link-filter').value);
            }
          };
          reader.onerror = function(e) {
            console.error("An error occurred reading file: ", file.name);
            filesProcessed++;
            if (filesProcessed === textFiles.length) {
              createGraph(tagData);
              updateLinkVisibility(document.getElementById('link-filter').value);
            }
        };
        
        // Start reading the file as text
        reader.readAsText(file);
    }); // This is where the forEach loop should end
}); // This closes the 'addEventListener' callback

function createGraph(tagData) {
    // Convert the tagData nodes and links into arrays for D3
    linksArray = Object.values(tagData.links);
    let nodesArray = Object.values(tagData.nodes).map(d => ({...d, radius: Math.sqrt(d.count*10)}));
    let node;
    let link;

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    const svg = d3.select('#graph').append('svg')
        .attr('viewBox', [0, 0, width, height])
        .attr('preserveAspectRatio', 'xMidYMid meet')
        .style('background-color', 'black');
  
    // Add zoom functionality
    svg.call(d3.zoom().on('zoom', (event) => {
      container.attr('transform', event.transform);
    }));
  
    // Group to hold all the elements for zooming
    const container = svg.append('g');
    // Define a collision force
    let collisionForce = d3.forceCollide(d => d.radius + 1) // Plus 1 or some padding
                            .iterations(1); // Lower iterations for performance, increase for accuracy
    // Create the force simulation
    const simulation = d3.forceSimulation(nodesArray)
        .force('charge', d3.forceManyBody().theta(0.9999).strength(d => -300 * d.radius))
        .force('link', d3.forceLink(linksArray).id(d => d.id).distance(100))
        .force('x', d3.forceX())
        .force('y', d3.forceY())
        .force('collide', collisionForce) // Add the collision force here
        .alphaDecay(0.1) // Default value is 0.0228, adjust as needed
        .velocityDecay(0.2)
        .on('tick', throttle(ticked, 150));

    const zoom = d3.zoom()
        .scaleExtent([0.1, 10]) // Set the scale extent for zooming
        .on('zoom', (event) => {
            container.attr('transform', event.transform);
            updateDetails(event.transform.k); // Update the graph details based on zoom level
        });

    svg.call(zoom);
    function mouseover(event, d) {
        if (!fixedNode) {
          highlightNodeAndLinks(d);
        }
      }
    
    function mouseout() {
        if (!fixedNode) {
          resetHighlight();
        }
      }

      function highlightNodeAndLinks(d) {
        // Highlight the nodes and links
        node.style('stroke', (o) => isConnected(d, o) ? 'red' : '')
            .style('stroke-width', (o) => isConnected(d, o) ? 2 : '');
        link.style('stroke', (o) => o.source === d || o.target === d ? 'red' : '')
            .style('stroke-width', (o) => o.source === d || o.target === d ? 2 : '');
      }
      
      function resetHighlight() {
        // Reset the nodes and links
        node.style('stroke', '')
            .style('stroke-width', '');
        link.style('stroke', '')
            .style('stroke-width', '');
      }
      function click(event, d) {
        if (fixedNode !== d) {
          // If another node is fixed, reset it
          if (fixedNode) resetHighlight();
          // Set the new fixed node and highlight it
          fixedNode = d;
          highlightNodeAndLinks(d);
        } else {
          // Clicking the fixed node again will reset and unfix it
          resetHighlight();
          fixedNode = null;
        }
      }
    function isConnected(a, b) {
        return linksArray.some(link => {
            return (link.source.id === a.id && link.target.id === b.id) || (link.source.id === b.id && link.target.id === a.id);
        });
    }
    function updateDetails(scale) {
        const isZoomedIn = scale > 1;
        const isZoomedOut = scale < 0.5;

        // Update node visibility and label visibility based on zoom level
         // Small dots when zoomed out
        node.style('fill', isZoomedOut ? '#333' : 'white'); // Different color for dots
        link.attr('stroke', 'rgba(255, 255, 255, 0.1)');
        labels.style('display', d => isZoomedIn ? 'block' : 'none'); // Hide labels when zoomed out
    }
    // Define SVG elements for links
    link = container.append('g')
        .attr('class', 'links')
        .selectAll('line')
        .data(linksArray)
        .enter().append('line')
        .attr('stroke-width', d => Math.sqrt(d.count))
        .attr('stroke', 'rgba(255, 255, 255, 0.01)'); // Almost entirely transparent

  
    // Define SVG elements for nodes
    node = container.append('g')
        .attr('class', 'nodes')
        .selectAll('circle')
        .data(nodesArray)
        .enter().append('circle')
        .attr('r', d => d.radius)
        .attr('fill', 'lightgrey')
        .on('mouseover', mouseover) // Ensure these handlers are set after 'node' is defined
        .on('mouseout', mouseout)
        .call(d3.drag()
            .on('start', dragstarted)
            .on('drag', dragged)
            .on('end', dragended));
    // Add event listeners here, after 'node' and 'link' are defined
    node.on('mouseover', mouseover)
        .on('click', click)
        .on('mouseout', mouseout);
  
    // Add text labels to nodes
    let labels = container.append('g')
      .attr('class', 'labels')
      .selectAll('text')
      .data(nodesArray)
      .enter().append('text')
        .text(d => d.id)
        .style('fill', 'black')
        .style('font-size', '12px') // Adjust font size as needed
        .style('text-anchor', 'middle')
        .style('alignment-baseline', 'middle')
        .style('pointer-events', 'none') // This ensures that the text isn't interactable and doesn't interfere with drag events
        .style('user-select', 'none') // Prevents the user from selecting the text
        // Adding the stroke (outline) to the text for better visibility
        .style('stroke', 'white')
        .style('stroke-width', '1px') // This value can be adjusted to make the outline thicker or thinner
        .style('paint-order', 'stroke'); // This ensures that the stroke is drawn behind the fill
    
  
    function ticked() {
        // Update link positions
        d3.selectAll('.links line')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        // Update node positions
        d3.selectAll('.nodes circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);

        // Update label positions
        d3.selectAll('.labels text')
            .attr('x', d => d.x)
            .attr('y', d => d.y);
    }
  
    // Drag functions for the nodes
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }
    
      function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
      }
    
      function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }
      // Start the simulation
      simulation.nodes(nodesArray).on("tick", ticked);
      simulation.force("link").links(linksArray);
  }

  function throttle(callback, limit) {
    var wait = false;
    return function () {
        if (!wait) {
            callback.apply(null, arguments);
            wait = true;
            setTimeout(function () {
                wait = false;
            }, limit);
        }
    };
}