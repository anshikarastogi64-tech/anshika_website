/**
 * Setup Demo Portal User and Project
 * Run this script to create demo@kellydesigners.com account with sample data
 */

const { db } = require('./db');
const bcrypt = require('bcryptjs');

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function setupDemo() {
  const demoEmail = 'demo@kellydesigners.com';
  const demoPassword = 'demo123';
  const demoPasswordHash = bcrypt.hashSync(demoPassword, 10);

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Check if demo user already exists
      db.get('SELECT id FROM portal_users WHERE email = ?', [demoEmail], (err, row) => {
        if (err) {
          console.error('Error checking demo user:', err);
          return reject(err);
        }

        let demoUserId;

        if (row) {
          demoUserId = row.id;
          console.log('✓ Demo user already exists:', demoUserId);

          // Update password in case it changed
          db.run('UPDATE portal_users SET password_hash = ? WHERE id = ?',
            [demoPasswordHash, demoUserId], (err) => {
              if (err) console.error('Error updating password:', err);
            });
        } else {
          // Create demo user
          demoUserId = uuid();
          db.run(
            'INSERT INTO portal_users (id, email, password_hash, full_name, role, dv_points_balance) VALUES (?, ?, ?, ?, ?, ?)',
            [demoUserId, demoEmail, demoPasswordHash, 'Demo User', 'CLIENT', 500],
            (err) => {
              if (err) {
                console.error('Error creating demo user:', err);
                return reject(err);
              }
              console.log('✓ Created demo user:', demoUserId);
            }
          );
        }

        // Get a designer to assign
        db.get('SELECT id FROM portal_users WHERE role = ? LIMIT 1', ['DESIGNER'], (err, designerRow) => {
          if (err) {
            console.error('Error finding designer:', err);
            return reject(err);
          }

          const designerId = designerRow ? designerRow.id : null;
          if (!designerId) {
            console.error('No designer found in database');
            return reject(new Error('No designer available'));
          }

          // Check if demo project exists
          db.get('SELECT id FROM portal_projects WHERE client_id = ?', [demoUserId], (err, projectRow) => {
            if (err) {
              console.error('Error checking demo project:', err);
              return reject(err);
            }

            if (projectRow) {
              console.log('✓ Demo project already exists:', projectRow.id);
              return resolve({ userId: demoUserId, projectId: projectRow.id });
            }

            // Create demo project
            const projectId = uuid();

            db.run(
              `INSERT INTO portal_projects (
                id, title, budget, current_stage, status, rtsp_link,
                client_id, designer_id, site_address, lifecycle_completed_stages, lifecycle_active_stages,
                created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                projectId,
                'Luxury Villa - Noida Extension',
                5000000,
                'Structure & Interior Work',
                'active',
                'https://demo-cctv-feed.example.com/stream1',
                demoUserId,
                designerId,
                'Plot 123, Sector 45, Noida Extension, UP 201301',
                JSON.stringify([0, 1, 2]), // Site prep, foundation, structure completed
                JSON.stringify([3]), // Interior work active
                new Date().toISOString()
              ],
            function(err) {
              if (err) {
                console.error('Error creating demo project:', err);
                return reject(err);
              }
              console.log('✓ Created demo project:', projectId);

              // Add demo timeline events
              const timelineEvents = [
                {
                  id: uuid(),
                  event_type: 'STAGE_COMPLETED',
                  title: 'Site Preparation Completed',
                  description: 'Site leveling and clearing completed successfully',
                  date: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: uuid(),
                  event_type: 'STAGE_COMPLETED',
                  title: 'Foundation Work Completed',
                  description: 'Foundation work completed with quality check',
                  date: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: uuid(),
                  event_type: 'STAGE_STARTED',
                  title: 'Structure Work In Progress',
                  description: 'Main structure construction is ongoing',
                  date: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: uuid(),
                  event_type: 'UPDATE',
                  title: 'First Floor Completed',
                  description: 'First floor structure and walls completed',
                  date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
                },
                {
                  id: uuid(),
                  event_type: 'UPDATE',
                  title: 'Roofing Work Started',
                  description: 'Roofing work has begun on schedule',
                  date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
                }
              ];

              let inserted = 0;
              timelineEvents.forEach(event => {
                db.run(
                  'INSERT INTO portal_timeline (id, project_id, event_type, title, description, event_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [event.id, projectId, event.event_type, event.title, event.description, event.date, event.date],
                  (err) => {
                    if (err) console.error('Error adding timeline event:', err);
                    inserted++;
                    if (inserted === timelineEvents.length) {
                      console.log('✓ Added', inserted, 'timeline events');
                    }
                  }
                );
              });

              // Add demo payments
              const payments = [
                { amount: 1000000, status: 'PAID', description: 'Initial Payment - 20%', date: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000) },
                { amount: 1250000, status: 'PAID', description: 'Foundation Milestone - 25%', date: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000) },
                { amount: 1000000, status: 'PAID', description: 'Structure Complete - 20%', date: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000) },
                { amount: 1000000, status: 'PUBLISHED', description: 'Interior Completion - 20%', date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
                { amount: 750000, status: 'PUBLISHED', description: 'Final Payment - 15%', date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }
              ];

              let paymentInserted = 0;
              payments.forEach(payment => {
                const paymentId = uuid();
                db.run(
                  'INSERT INTO portal_client_payments (id, project_id, amount, status, description, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                  [paymentId, projectId, payment.amount, payment.status, payment.description, payment.date.toISOString().split('T')[0], new Date().toISOString()],
                  (err) => {
                    if (err) console.error('Error adding payment:', err);
                    paymentInserted++;
                    if (paymentInserted === payments.length) {
                      console.log('✓ Added', paymentInserted, 'payments');
                    }
                  }
                );
              });

              resolve({ userId: demoUserId, projectId });
            }
          );
          });
        });
      });
    });
  });
}

setupDemo()
  .then(result => {
    console.log('\n✅ Demo portal setup complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email: demo@kellydesigners.com');
    console.log('🔑 Password: demo123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('User ID:', result.userId);
    console.log('Project ID:', result.projectId);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error setting up demo:', err);
    process.exit(1);
  });
